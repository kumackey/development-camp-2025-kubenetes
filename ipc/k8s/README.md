# Kubernetes Deployment Guide

Hono + RedisアプリケーションをMinikube環境にデプロイする手順。

## 構成

- **deployment.yml**: Redis、API、Worker の Deployment
- **service.yml**: Redis、API の Service
- **hpa.yml**: API、Worker の HorizontalPodAutoscaler

## デプロイ

```bash
# Minikube起動（3ノード構成）
minikube start --nodes 3

# イメージビルド
cd ..
docker build -t local/hono-retry-demo:1.0 hono-retry-demo/

# Minikubeにロード
minikube image load local/hono-retry-demo:1.0

# デプロイ
cd k8s/
kubectl apply -f .

# 状態確認
kubectl get pods -o wide
kubectl get services
```

## アクセス

```bash
# ポートフォワード
kubectl port-forward service/hono-api 3000:3000

# または minikube service
minikube service hono-api
```

## 動作確認

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

## 監視

```bash
# Pod状態
kubectl get pods -o wide -w

# APIログ
kubectl logs -f deploy/hono-api

# Workerログ
kubectl logs -f deploy/hono-worker
```

## 非同期計算デモ

```bash
# 自動デモスクリプト
./demo-resilience.sh
```

## 更新・再デプロイ

```bash
# コード変更後
cd ..
docker build -t local/hono-retry-demo:1.0 hono-retry-demo/
minikube image load local/hono-retry-demo:1.0

# Pod再起動
kubectl delete pod -l app=hono-api
kubectl delete pod -l app=hono-worker
```

## クリーンアップ

```bash
kubectl delete -f .
minikube stop
minikube delete
```
