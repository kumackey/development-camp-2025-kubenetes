# Dockerfile
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# パッケージ定義を先にコピー（キャッシュが効くように）
COPY package.json package-lock.json* ./

RUN npm install --omit=dev

# ソースコードをコピー
COPY index.js ./
COPY src/ ./src/

EXPOSE 3000

# 起動スクリプトを作成
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'if [ "$APP_TYPE" = "api" ]; then' >> /app/entrypoint.sh && \
    echo '  exec node src/api.js' >> /app/entrypoint.sh && \
    echo 'elif [ "$APP_TYPE" = "worker" ]; then' >> /app/entrypoint.sh && \
    echo '  exec node src/worker.js' >> /app/entrypoint.sh && \
    echo 'else' >> /app/entrypoint.sh && \
    echo '  exec node index.js' >> /app/entrypoint.sh && \
    echo 'fi' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# APP_TYPEで起動モードを切り替え（api/worker/デフォルト）
ENTRYPOINT ["/app/entrypoint.sh"]

