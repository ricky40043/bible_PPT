# Dockerfile 4.0 - 終極穩定版 (解決 OpenCC 與相關依賴崩潰)
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 使用完整版 Python 以確保 libxml, libjpeg, OpenCC 字典等系統依賴完整
FROM python:3.10
WORKDIR /app

# 安裝基本依賴
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 複製代碼
COPY backend/*.py ./
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# 確保輸出編碼為 UTF-8
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
