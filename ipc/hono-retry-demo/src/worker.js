// worker.js - Redis Stream Workerプロセス
import { createRedisClient } from './shared.js'

// Worker用 Redis クライアント（XREADでブロッキングするため専用インスタンス）
const redisWorker = createRedisClient('Redis Worker')
// 結果保存用 Redis クライアント
const redisResult = createRedisClient('Redis Result')

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
          await redisResult.set(
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

// ワーカープロセスを起動
startWorker().catch(err => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
