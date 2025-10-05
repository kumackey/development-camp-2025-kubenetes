# Hono + Redis Demo Application

Redis Streamsを使った非同期ワーカーパターンのデモアプリケーション。

## アーキテクチャ

- **API Server** (`src/api.js`): Honoアプリ、タスクをRedis Streamにエンキュー
- **Worker** (`src/worker.js`): Redis Streamを監視してタスクを処理
- **Redis**: Stream（タスクキュー）、Hash（結果保存）

## ローカル開発

```bash
# 依存関係のインストール
npm install

# Redis をDockerで起動
docker run -d -p 6379:6379 redis:7-alpine

# API起動
npm run start:api

# Worker起動（別ターミナル）
npm run start:worker
```

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `APP_TYPE` | - | `api` or `worker` （Dockerモード切替用） |
| `REDIS_HOST` | `redis` | Redisホスト名 |
| `REDIS_PORT` | `6379` | Redisポート番号 |
| `PORT` | `3000` | APIリスニングポート |

### 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# 同期計算
curl -X POST http://localhost:3000/calculate \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'

# 非同期計算
curl -X POST http://localhost:3000/calculate/async \
  -H "Content-Type: application/json" \
  -d '{"a": 100, "b": 250}'

# 結果取得
curl http://localhost:3000/result/<requestId>
```

## Docker

```bash
# ビルド
docker build -t local/hono-retry-demo:1.0 .

# API起動
docker run -d -p 3000:3000 \
  -e APP_TYPE=api \
  -e REDIS_HOST=host.docker.internal \
  local/hono-retry-demo:1.0

# Worker起動
docker run -d \
  -e APP_TYPE=worker \
  -e REDIS_HOST=host.docker.internal \
  local/hono-retry-demo:1.0
```

## Kubernetes

デプロイ方法は [../k8s/README.md](../k8s/README.md) を参照してください。
