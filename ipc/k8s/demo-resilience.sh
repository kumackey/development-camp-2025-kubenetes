#!/bin/bash

# ==============================================
# 非同期通信デモスクリプト
# ==============================================
# このデモでは、Redis Streamsを使った非同期ワーカーパターンの
# 動作を確認します。

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}非同期通信デモ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 計算値の定義
CALC_A=500
CALC_B=500

# Step 1: ポートフォワードを開始
echo -e "${YELLOW}Step 1: ポートフォワードを開始...${NC}"
kubectl port-forward service/hono-api 3000:3000 > /dev/null 2>&1 &
PF_PID=$!
echo "ポートフォワード PID: $PF_PID"
sleep 2
echo -e "${GREEN}✓ ポートフォワード開始完了${NC}"
echo ""

# クリーンアップ関数
cleanup() {
    echo ""
    echo -e "${YELLOW}クリーンアップ中...${NC}"
    kill $PF_PID 2>/dev/null || true
    echo -e "${GREEN}✓ クリーンアップ完了${NC}"
}
trap cleanup EXIT

# Step 2: 非同期リクエストを送信
echo -e "${YELLOW}Step 2: 非同期リクエストを送信...${NC}"
echo "計算リクエスト: $CALC_A + $CALC_B"
RESPONSE=$(curl -s -X POST http://localhost:3000/calculate/async \
  -H "Content-Type: application/json" \
  -d "{\"a\": $CALC_A, \"b\": $CALC_B}")

REQUEST_ID=$(echo $RESPONSE | grep -o '"requestId":"[^"]*' | cut -d'"' -f4)
echo "レスポンス: $RESPONSE"
echo -e "${GREEN}✓ Request ID: ${REQUEST_ID}${NC}"
echo ""

# Step 3: 結果を確認（最大30秒待機）
echo -e "${YELLOW}Step 3: 結果を確認中...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 5
    RESULT=$(curl -s http://localhost:3000/result/$REQUEST_ID)
    STATUS=$(echo $RESULT | grep -o '"status":"[^"]*' | cut -d'"' -f4)

    if [ "$STATUS" = "completed" ]; then
        CALC_RESULT=$(echo $RESULT | grep -o '"result":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ 計算が完了しました！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo "Request ID: $REQUEST_ID"
        echo "計算結果: $CALC_A + $CALC_B = ${CALC_RESULT}"
        echo ""
        echo -e "${BLUE}重要なポイント:${NC}"
        echo "1. APIがリクエストを受け取り、Redis Streamにタスクをエンキュー"
        echo "2. Workerが非同期でRedis Streamからタスクを取得して処理"
        echo "3. 結果がRedis Hashに保存される"
        echo "4. APIが結果を取得して返却"
        echo ""
        echo -e "${GREEN}✓ 非同期ワーカーパターンの動作が確認されました！${NC}"
        exit 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "待機中... ($ATTEMPT/$MAX_ATTEMPTS) - Status: $STATUS"
done

echo -e "${RED}✗ タイムアウト: 30秒以内に結果が得られませんでした${NC}"
exit 1
