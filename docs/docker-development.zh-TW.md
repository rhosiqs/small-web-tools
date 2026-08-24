# Docker 開發環境

此方法會在儲存庫支援的 Node.js 22 環境中執行 Vite 開發伺服器，同時將原始碼保留在
主機上以支援即時重新載入。Docker Compose 會把容器相依套件存放在具名 volume，避免
主機的 `node_modules` 內容與特定平台的二進位檔混入容器安裝結果。

## 前置需求

- 目前仍受支援且具備 Docker Compose v2 的 Docker（也可使用 Docker Desktop）。
- 主機上的 `5173` 連接埠必須可用。

此流程不需要在主機安裝 Node.js 或 npm。

## 啟動開發伺服器

在儲存庫根目錄建置 image 並啟動 Vite：

```bash
docker compose up --build
```

開啟 <http://localhost:5173>。主機工作樹的變更會掛載至容器並觸發 Vite 重新載入。
在前景執行時按 `Ctrl+C` 即可停止；也可用 `docker compose up --build -d` 在背景啟動，
之後再執行：

```bash
docker compose down
```

## 執行專案指令

使用相同 image 與相依套件 volume 的一次性容器執行檢查，例如：

```bash
docker compose run --rm web npm run test:run
docker compose run --rm web npm run build
docker compose run --rm web npm run verify
```

若開發服務已在執行，可改用 `docker compose exec web <command>`。輕量開發 image 未安裝
Playwright 端對端測試需要的瀏覽器二進位檔；請在文件所述的主機／CI 環境執行該測試，
不要在此容器中執行。

## 更新相依套件與清理

變更 `package.json` 或 `package-lock.json` 後，請重新建置 image，並重建相依套件
volume，使其從新 image 初始化：

```bash
docker compose down --volumes
docker compose up --build
```

`docker compose down --volumes` 只會刪除此 Compose 專案的具名相依套件 volume，
不會刪除 bind mount 工作樹中的原始碼。

## API 限制

此 Docker 方法刻意與 `npm run dev` 相同：Vite 只會模擬 `/api/iplookup`，不會執行完整的
Cloudflare Pages Functions 與 rate-limiter Worker 拓撲。若要使用匯率、網站字型擷取或
服務繫結整合，請在主機上依照 [`CONTRIBUTING.zh-TW.md`](../CONTRIBUTING.zh-TW.md#本機開發)
的雙終端 Wrangler 方法操作。

切勿將 `.dev.vars`、`.env` 檔案、Wrangler 狀態或憑證複製進 image。已提交的
`.dockerignore` 會將這些本機檔案排除在建置 context 之外。
