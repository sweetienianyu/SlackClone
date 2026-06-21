#!/bin/bash
# Render 启动脚本
set -e

cd server
npx prisma migrate deploy
node dist/index.js
