// api.js - APIサーバー（Honoアプリケーション）
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { randomUUID } from 'crypto'
import { createRedisClient } from './shared.js'

const app = new Hono()

// API用 Redis クライアント
const redis = createRedisClient('Redis API')

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
    }
      // 結果がまだない場合はpending状態を返す
    console.log(`[Result] No result found for ${requestId}, status: pending`)
    return c.json({
      requestId,
      status: 'pending',
      message: 'Task is still being processed or does not exist'
    })
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
// アプリケーション起動
// ==========================================

// サーバ起動
const port = Number(process.env.PORT || 3000)
serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 Hono API Server running on port ${port}`)
})
