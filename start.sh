#!/bin/bash

# 顏色設定 (用於區分輸出)
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}>>> 正在清理舊有的服務進程...${NC}"
# 殺掉佔用 5001 (後端) 與 3001 (前端) 的舊進程
lsof -ti :5001 | xargs kill -9 2>/dev/null
lsof -ti :3001 | xargs kill -9 2>/dev/null

echo -e "${BLUE}>>> 正在重新啟動聖經 PPT 產生器系統...${NC}"

# 1. 啟動後端 (FastAPI)
echo -e "${GREEN}[後端] 啟動中 (Port 5001)...${NC}"
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 5001 --reload &
BACKEND_PID=$!
cd ..

# 2. 啟動前端 (Vite)
echo -e "${GREEN}[前端] 啟動中 (Port 3001)...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${BLUE}>>> 系統已在背景執行。${NC}"
echo -e "${BLUE}>>> 前端網址: http://localhost:3001${NC}"
echo -e "${BLUE}>>> 按 Ctrl+C 可停止所有服務。${NC}"

# 處理終止訊號 (Ctrl+C)
cleanup() {
    echo -e "\n${BLUE}>>> 正在關閉所有服務...${NC}"
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT

# 保持腳本運行
wait
