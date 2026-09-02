# Dockerfile 5.0 - 生產穩定版 (Gunicorn)
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.10
WORKDIR /app

# 安裝 Python 依賴與 Gunicorn (生產級啟動器)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# 複製後端 Python 文件
COPY backend/*.py ./
# 後台頁（使用紀錄）
COPY backend/admin.html ./

# 複製經文資料庫
COPY backend/data ./data

# 複製 PPT 範本；產生簡報時 python-pptx 需要讀取這個檔案
COPY ["經文範本.pptx", "./經文範本.pptx"]

# 複製前端成品
# 這裡確保 frontend/dist 的路徑與 main.py 相符
RUN mkdir -p frontend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# 使用 Gunicorn 啟動。這比單純的 uvicorn 更能處理啟動時的超時與健康檢查問題
# $PORT 會由 Cloud Run 自動注入
CMD gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 0 --keep-alive 75
