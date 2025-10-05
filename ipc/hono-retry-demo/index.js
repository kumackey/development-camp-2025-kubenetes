// server.js
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'

const app = new Hono()

// Redis 接続設定
const REDIS_HOST = process.env.REDIS_HOST || 'redis'
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)

// Redis接続の共通設定
const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => {
    const delay = Math.min(times * 2000, 30000) // 2s, 4s, 6s... 最大30s
    console.log(`[Redis Retry] Retry #${times}, delay=${delay}ms`)
    return delay
  },
  reconnectOnError: (err) => {
    console.warn('[Redis ReconnectOnError]', err?.message)
    return true
  }
}

// API用 Redis クライアント
const redis = new Redis(redisConfig)

// ワーカー用 Redis クライアント（XREADでブロッキングするため別インスタンス）
const redisWorker = new Redis(redisConfig)

// Redis の各イベントをログ出力
redis.on('connect', () => console.log('[Redis API] connected'))
redis.on('ready', () => console.log('[Redis API] ready'))
redis.on('end', () => console.warn('[Redis API] connection ended'))
redis.on('error', (err) => console.error('[Redis API] error', err.message))

redisWorker.on('connect', () => console.log('[Redis Worker] connected'))
redisWorker.on('ready', () => console.log('[Redis Worker] ready'))
redisWorker.on('end', () => console.warn('[Redis Worker] connection ended'))
redisWorker.on('error', (err) => console.error('[Redis Worker] error', err.message))

// ==========================================
// ユーティリティ関数
// ==========================================

/**
 * 結果をポーリングで待機する関数
 * @param {string} requestId - リクエストID
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
 * @param {number} intervalMs - ポーリング間隔（ミリ秒）
 * @returns {Promise<{result: number, status: string} | null>}
 */
async function waitForResult(requestId, timeoutMs = 10000, intervalMs = 100) {
  const startTime = Date.now()
  const resultKey = `results:${requestId}`

  while (Date.now() - startTime < timeoutMs) {
    const result = await redis.get(resultKey)
    if (result) {
      // 結果が見つかった場合、パースして返す
      const parsed = JSON.parse(result)
      // 結果を削除（クリーンアップ）
      await redis.del(resultKey)
      return parsed
    }
    // 指定間隔待機
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  // タイムアウト
  return null
}

// ==========================================
// API エンドポイント
// ==========================================

// シンプルなヘルスチェック
app.get('/health', (c) => c.text('OK'))

// Redis 通信を試すAPI
app.get('/redis', async (c) => {
  try {
    const key = 'demo:ts'
    const val = new Date().toISOString()
    await redis.set(key, val, 'EX', 60)
    const result = await redis.get(key)
    return c.json({ ok: true, key, result })
  } catch (e) {
    console.error('[Redis Error]', e.message)
    return c.json({ ok: false, error: e.message }, 503)
  }
})

// 非同期計算API（Redis Streams使用）
app.post('/calculate', async (c) => {
  try {
    // リクエストボディを取得
    const body = await c.req.json()
    const { a, b } = body

    // バリデーション
    if (typeof a !== 'number' || typeof b !== 'number') {
      return c.json({
        error: 'Invalid input: a and b must be numbers',
        status: 'error'
      }, 400)
    }

    // リクエストIDを生成
    const requestId = randomUUID()
    console.log(`[Calculate] New request ${requestId}: ${a} + ${b}`)

    // Redis Streamにタスクを追加
    await redis.xadd(
      'tasks',           // Stream名
      '*',               // ID自動生成
      'type', 'addition',
      'requestId', requestId,
      'a', String(a),
      'b', String(b),
      'timestamp', new Date().toISOString()
    )

    console.log(`[Calculate] Task enqueued to stream: ${requestId}`)

    // 結果をポーリングで待機（最大10秒）
    const result = await waitForResult(requestId, 10000, 100)

    if (result) {
      console.log(`[Calculate] Result received for ${requestId}: ${result.result}`)
      return c.json({
        requestId,
        result: result.result,
        status: 'completed'
      })
    }

    console.warn(`[Calculate] Timeout waiting for result: ${requestId}`)
    return c.json({
      requestId,
      error: 'Timeout waiting for result',
      status: 'timeout'
    }, 504)
  } catch (e) {
    console.error('[Calculate Error]', e.message)
    return c.json({
      error: e.message,
      status: 'error'
    }, 500)
  }
})

// 結果取得API（非同期処理の結果を後から確認）
app.get('/result/:requestId', async (c) => {
  try {
    const { requestId } = c.req.param()
    const resultKey = `results:${requestId}`

    console.log(`[Result] Checking result for ${requestId}`)

    // Redis Hashから結果を取得
    const result = await redis.get(resultKey)

    if (result) {
      const parsed = JSON.parse(result)
      console.log(`[Result] Found result for ${requestId}: ${parsed.result}`)
      return c.json({
        requestId,
        result: parsed.result,
        status: parsed.status,
        timestamp: parsed.timestamp
      })
    } else {
      // 結果がまだない場合はpending状態を返す
      console.log(`[Result] No result found for ${requestId}, status: pending`)
      return c.json({
        requestId,
        status: 'pending',
        message: 'Task is still being processed or does not exist'
      })
    }
  } catch (e) {
    console.error('[Result Error]', e.message)
    return c.json({
      error: e.message,
      status: 'error'
    }, 500)
  }
})

// 非同期計算API（即座にrequestIdを返す、ポーリングなし）
app.post('/calculate/async', async (c) => {
  try {
    // リクエストボディを取得
    const body = await c.req.json()
    const { a, b } = body

    // バリデーション
    if (typeof a !== 'number' || typeof b !== 'number') {
      return c.json({
        error: 'Invalid input: a and b must be numbers',
        status: 'error'
      }, 400)
    }

    // リクエストIDを生成
    const requestId = randomUUID()
    console.log(`[Calculate Async] New request ${requestId}: ${a} + ${b}`)

    // Redis Streamにタスクを追加
    await redis.xadd(
      'tasks',           // Stream名
      '*',               // ID自動生成
      'type', 'addition',
      'requestId', requestId,
      'a', String(a),
      'b', String(b),
      'timestamp', new Date().toISOString()
    )

    console.log(`[Calculate Async] Task enqueued to stream: ${requestId}`)

    // すぐにrequestIdを返す（結果は待たない）
    return c.json({
      requestId,
      status: 'accepted',
      message: 'Task has been queued for processing',
      checkResultUrl: `/result/${requestId}`
    }, 202)
  } catch (e) {
    console.error('[Calculate Async Error]', e.message)
    return c.json({
      error: e.message,
      status: 'error'
    }, 500)
  }
})

app.get('/', (c) => c.text('Hello from Hono + Redis!'))

// ==========================================
// ワーカープロセス
// ==========================================

/**
 * Redis Streamを監視してタスクを処理するワーカー
 */
async function startWorker() {
  console.log('[Worker] Starting worker process...')
  let lastId = '0' // 初回は最初から読み取る

  while (true) {
    try {
      // Redis Streamからメッセージを読み取る（5秒ブロッキング）
      const results = await redisWorker.xread(
        'BLOCK', 5000,      // 5秒間ブロック
        'STREAMS', 'tasks', lastId
      )

      if (!results || results.length === 0) {
        // タイムアウトまたはメッセージなし
        continue
      }

      // results: [[streamName, [[messageId, [field, value, field, value, ...]]]]]
      const [streamName, messages] = results[0]

      for (const [messageId, fields] of messages) {
        // fields配列をオブジェクトに変換
        const task = {}
        for (let i = 0; i < fields.length; i += 2) {
          task[fields[i]] = fields[i + 1]
        }

        console.log(`[Worker] Processing message ${messageId}:`, task)

        // typeがadditionの場合のみ処理
        if (task.type === 'addition') {
          const a = Number(task.a)
          const b = Number(task.b)
          const result = a + b

          console.log(`[Worker] Calculating: ${a} + ${b} = ${result}`)

          // 結果をRedis Hashに保存
          const resultKey = `results:${task.requestId}`
          await redis.set(
            resultKey,
            JSON.stringify({
              result,
              status: 'completed',
              timestamp: new Date().toISOString()
            }),
            'EX', 60 // 60秒で自動削除
          )

          console.log(`[Worker] Result saved: ${resultKey}`)

          // 処理済みメッセージを削除
          await redisWorker.xdel('tasks', messageId)
          console.log(`[Worker] Message deleted: ${messageId}`)
        } else {
          console.warn(`[Worker] Unknown task type: ${task.type}`)
        }

        // lastIdを更新
        lastId = messageId
      }
    } catch (err) {
      console.error('[Worker] Error:', err.message)
      // エラー時は少し待機してからリトライ
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// ==========================================
// アプリケーション起動
// ==========================================

// サーバ起動
const port = Number(process.env.PORT || 3000)
serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 Hono running on port ${port}`)
})

// ワーカープロセスを起動（非同期）
startWorker().catch(err => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})

