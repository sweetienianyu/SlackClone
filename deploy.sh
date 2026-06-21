#!/bin/bash
# SlackApp 一键部署脚本
# 用法: bash deploy.sh
# 部署后只需运行一个 Node 进程，服务端自动托管前端静态文件

set -e

echo "=== SlackApp Deploy ==="

# 1. 安装依赖
echo "[1/5] Installing dependencies..."
cd server && npm install && npx prisma generate && cd ..
cd client && npm install && cd ..

# 2. 构建客户端
echo "[2/5] Building client..."
cd client && npm run build && cd ..

# 3. 构建服务端
echo "[3/5] Building server..."
cd server && npx tsc && cd ..

# 4. 初始化数据库
echo "[4/5] Running database migrations..."
cd server && npx prisma migrate deploy && cd ..

# 5. 启动服务
echo "[5/5] Starting server..."
export DATABASE_URL="${DATABASE_URL:-file:./data/prod.db}"
export JWT_SECRET="${JWT_SECRET:-slack-app-demo-secret-change-me}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3001}"
export PORT="${PORT:-3001}"

mkdir -p logs

cd server
node dist/index.js > ../logs/server.log 2>&1 &
SERVER_PID=$!
cd ..

echo ""
echo "=== Deploy Complete ==="  
echo "Server PID: $SERVER_PID"
echo "URL:        http://localhost:${PORT:-3001}"
echo "Logs:       tail -f logs/server.log"
echo "Stop:       kill $SERVER_PID"
