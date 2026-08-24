# Small Web Tools

<p align="center">
  <a href="README.md">English</a>
  &nbsp;·&nbsp;
  <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="CONTRIBUTING.zh-TW.md">貢獻指南</a>
  &nbsp;·&nbsp;
  <a href="ARCHITECTURE.zh-TW.md">架構</a>
  &nbsp;·&nbsp;
  <a href="PRIVACY.zh-TW.md">隱私權</a>
</p>

<p align="center">
  <a href="https://github.com/hhter2/small-web-tools/tags"><img src="https://img.shields.io/github/v/tag/hhter2/small-web-tools?sort=semver&amp;label=version" alt="版本：最新 Git 標籤"></a>
  <a href="https://github.com/hhter2/small-web-tools/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/hhter2/small-web-tools/ci.yml?branch=develop&amp;label=CI" alt="CI 狀態"></a>
  <a href="https://github.com/hhter2/small-web-tools/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a" alt="MIT 授權條款"></a>
</p>

Small Web Tools 是一套以瀏覽器為基礎的日常工具集合，涵蓋文字、開發工作、檔案、媒體、網路、生物資訊與快速計算。它是一個單頁 React 應用程式：選取工具時只會切換目前畫面，不需要重新載入整個頁面。

## 使用網站

1. 從儀表板開始，選擇分類或使用搜尋框。
2. 從導覽列選取工具。每個工具都有自己的 URL 路徑，因此可以將例如 `/home/color` 的頁面加入書籤或分享。
3. 輸入文字、選擇檔案，或使用相關控制項。結果會在目前頁面更新。
4. 需要時使用淺色／深色切換。選定的主題、桌面版側邊欄是否收合，以及最近開啟的工具都會儲存在瀏覽器中。

在手機或窄螢幕上，導覽列會變成可由選單按鈕開啟的抽屜式介面。

### 語言與在地化

使用標頭中的 **Language** 選單，在 English (`en-US`) 與繁體中文 (`zh-TW`) 之間切換。
English 是預設與 fallback 語言。選定的地區設定會以 `small-web-tools.locale` 儲存在
本機；只有在沒有已儲存偏好時才會使用瀏覽器語言。路由 ID、URL 路徑與技術識別碼保持
穩定，導覽、搜尋中繼資料、工具控制項、錯誤、通知與輔助標籤則會在地化。讀者可見的
數字、日期、排序與單字計數估算會使用目前地區設定；使用者內容與演算法解讀不會翻譯。

### 使用者群組與 Simple 模式

首頁介紹旁的使用者群組切換器，可以顯示未變更的完整首頁，或為一般使用者、開發人員、生物資訊研究人員、設計師或學生整理的工具集合。頂端標頭會保留分類選單。

每個使用者群組選擇都會導向可加入書籤的網址：

- `/home`
- `/home/daily`
- `/home/developer`
- `/home/bioinformatics`
- `/home/designer`
- `/home/student`

開啟工具時，工作區路徑會保留在網址中，因此像 `/home/developer/code-preview` 這樣的連結可以同時還原選定的工作區與要求開啟的工具。

獨立的 **Simple 模式**介面位於 `/simple`。它提供涵蓋所有工具的大型搜尋，以及八個日常必備工具的精簡捷徑。在此模式開啟的工具會保留在精簡介面中，網址例如 `/simple/color`；使用 **離開 Simple 模式**或品牌圖示即可返回 `/home`。

## 工具指南

### 文字

- **文字計數器** — 計算單字、字元、行數與閱讀時間。
- **大小寫切換器** — 將文字轉換為大寫、小寫、句首大寫、標題大小寫或自訂詞彙大小寫。

### 開發

- **斜線轉換器** — 轉換 Windows 與網頁格式的路徑。
- **ASCII 轉換器**與**Unicode 轉換器** — 將文字與字元編碼互相轉換。
- **URL 編碼與解碼器** — 編碼或解碼完整 URL、元件及非 ASCII 文字。
- **Markdown 預覽器** — 在本機編輯、上傳、預覽與下載 Markdown。
- **進位轉換器** — 在二進位、八進位、十進位、十六進位與六十進位之間轉換數值。
- **VS Code 預覽器** — 編輯並醒目顯示含行號的程式碼，提供外觀控制，以及本機來源檔或 PNG 下載功能；程式碼檔案上傳上限為 2 MiB。
- **網站字型擷取器** — 檢查公開網站中受限制的字型宣告，不會下載字型檔案。
- **資料夾分析器** — 檢查選定資料夾的結構與指標。

### 網路

- **IP 查詢** — 查詢 IP 位址與位置資訊。
- **網路速度測試** — 測量延遲、下載與上傳效能。

### 媒體

- **色彩轉換器** — 處理色碼、色盤與 HSL 光譜。
- **圖片中繼資料**、**文件中繼資料**、**音訊中繼資料**與**影片中繼資料** — 檢查支援的本機檔案及其中繼資料。
- **媒體分割器** — 擷取影片的音訊軌與無聲影片軌。
- **SVG 轉 PNG** — 預覽 SVG 標記並匯出透明或白色背景的 PNG。

### 生物資訊

- **DNA/RNA 轉換器** — 轉換序列方向、互補序列與顯示模式。
- **密碼子表** — 探索 RNA 密碼子、胺基酸與篩選條件。
- **Phred 尺度轉換器** — 將鹼基判讀與比對品質分數轉換為錯誤機率。

### 工具

- **貨幣轉換器**與**日期與時間計算器** — 執行常見計算。
- **羅馬數字轉換器** — 在十進位與羅馬數字表示法之間轉換經過驗證的數值。
- **QR Code 產生器**與**條碼產生器** — 建立可下載的代碼。
- **QR Code 與條碼掃描器** — 使用相機或圖片檔案掃描。
- **密碼產生器**與**密碼強度** — 產生或評估密碼。
- **隨機轉盤** — 以密碼學安全的方式初始化選擇，並匯出可在本機驗證的抽選紀錄。

## 隱私權與網路存取

以檔案為主的工具會盡可能在瀏覽器中處理所選檔案；檔案不會傳送到本專案進行分析。部分功能必須使用網路存取：

- IP 查詢會查詢伺服器端的查詢端點與外部 IP 服務供應商。
- 網站字型擷取器會透過同源端點掃描受限制的公開 HTML 與 CSS，只回傳宣告中的中繼資料；不會預覽或下載找到的字型檔案。正式環境只有在目前的 Cloudflare runtime 對外連線驗證 metadata 與部署的 compatibility date 及 fetch 實作相符時才會提供掃描。
- 網路速度測試會測量實際網路流量。
- 貨幣轉換器只會在取得同意後要求即時匯率；手動匯率仍保留在本機。
- 圖片與 IP 地圖只會在取得地圖同意後連線至 OpenStreetMap；即使不嵌入地圖，座標仍可使用。
- 媒體分割器會在第一次處理時從 unpkg 下載固定版本的 FFmpeg WebAssembly 引擎，並在執行前驗證其大小與 SHA-256。媒體會保留在瀏覽器中。
- 相機掃描需要瀏覽器的相機權限。

頁尾的 **隱私權**路由 `/home/privacy` 會列出每個宣告的網路服務、觸發條件、傳送資料、同意模式與替代方案。處理敏感內容前，請查看該政策、工具本身的標籤與瀏覽器權限。

## 在本機執行

需要 Node.js 22 或 Node.js 24，以及 npm 10.9.2。Node 22 是儲存庫的預設版本（`.nvmrc`）；`package.json` 固定 npm 版本，而 CI 會使用完全相同的 npm 版本驗證兩個支援的 Node.js 版本。

```bash
npm install --global npm@10.9.2
npm ci
npm run dev
```

Vite 啟動時會印出本機 URL。要進行正式環境建置與本機預覽：

```bash
npm run build
npm run preview
```

使用以下指令執行完整的本機驗證與瀏覽器操作流程：

```bash
npm run verify
npm run test:e2e
```

`npm run i18n:check` 會驗證成對的地區設定資源，`npm run i18n:audit` 會掃描 JSX 中
未審查的使用者可見字串，`npm run docs:check` 會檢查文件一致性。三項檢查都包含在
`npm run verify` 中。

`npm run dev` 只會模擬 IP 查詢函式（`/api/iplookup`）。若要在本機執行所有 Cloudflare Pages Functions（貨幣匯率與網站字型擷取），請依照 `CONTRIBUTING.zh-TW.md` 中的 Pages／Worker 雙終端機說明。執行 `npm run platform:integration` 以進行自動化的並行限制與故障關閉服務繫結檢查。

Cloudflare Pages 正式環境建置必須使用 Node.js 22 或 24，先執行 `npm ci` 再執行 `npm run build`，並發布 `dist/`。

### HSTS 部署階段

儲存庫目前提交的回應政策處於 HSTS 初始階段：`Strict-Transport-Security: max-age=86400`。這個階段刻意省略 `includeSubDomains` 與 `preload`。部署後，請使用以下指令驗證實際的正式環境回應與 HTTP 重新導向：

```bash
DEPLOYED_BASE_URL=https://small-web-tools.pages.dev npm run test:e2e:deployed
```

請維持一日階段，直到完成監控以及回滾／網域擁有權審查。之後延長至 30 日與一年需要另外取得營運核准；子網域與 preload 則需要明確的完整網域稽核。

## 文件

維護中的說明文件以英文檔案搭配 .zh-TW.md 結尾的繁體中文對照檔。每份文件頂端的語言連結會維持同一種語言的導覽。TODO.md 特別維持英文單一版本。

- [CONTRIBUTING.zh-TW.md](CONTRIBUTING.zh-TW.md) — 工程標準與本機執行說明。
- [PRIVACY.zh-TW.md](PRIVACY.zh-TW.md) — 隱私權政策與網路服務揭露。
- [SECURITY.md](SECURITY.md) — 支援版本與私密漏洞通報管道。
- [TODO.md](TODO.md) — 目前待辦事項、已完成工作與專案更新流程（僅提供英文）。
- [ARCHITECTURE.zh-TW.md](ARCHITECTURE.zh-TW.md) — 架構、路由清單、共用 UI 慣例與開發人員指南。

## 授權條款

本專案採用 MIT 授權條款。詳情請參閱 [LICENSE](LICENSE) 檔案。
Copyright (c) 2026 Rhosiqs