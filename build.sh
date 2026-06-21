#!/bin/bash
# Render 构建脚本
set -e

echo "=== Building Server ==="
cd server
npm install
npx prisma generate
npx tsc
cd ..

echo "=== Building Client ==="
cd client
npm install
npm run build
cd ..

echo "=== Build Complete ==="
