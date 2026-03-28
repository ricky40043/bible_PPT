# 聖經 PPT 產生器 (Bible PPT Generator)

本專案是一個整合 FastAPI 與 React 的聖經投影與 PPT 自動生成系統。

## 功能特色
- **線上同步投影**：支援主控端與投影端 WebSocket 即時同步，掃描 QR Code 即可隨時加入。
- **PPT 自動生成**：一鍵產生符合禮拜模板的 PowerPoint (36pt 黃字、黑底)。
- **多版本支援**：支援 CUNP (和合本), RCUV (和合本修訂版), CCB (當代聖經)。
- **全自動部署 (CI/CD)**：整合 GitHub 與 Google Cloud Build，只要 `git push` 即自動部署至 Cloud Run。

## 部署說明
本專案已配置 `cloudbuild.yaml` 與 `Dockerfile`。
部署網址：[https://bible-ppt-generator-996480099740.asia-east1.run.app](https://bible-ppt-generator-996480099740.asia-east1.run.app)
