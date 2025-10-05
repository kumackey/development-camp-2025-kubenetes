// shared.js - Redis接続設定の共通化
import Redis from 'ioredis'

// Redis 接続設定
export const REDIS_HOST = process.env.REDIS_HOST || 'redis'
export const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)

// Redis接続の共通設定
export const redisConfig = {
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

// Redis クライアントを作成する関数
export function createRedisClient(name = 'Redis') {
  const client = new Redis(redisConfig)

  client.on('connect', () => console.log(`[${name}] connected`))
  client.on('ready', () => console.log(`[${name}] ready`))
  client.on('end', () => console.warn(`[${name}] connection ended`))
  client.on('error', (err) => console.error(`[${name}] error`, err.message))

  return client
}
