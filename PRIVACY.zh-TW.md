# 隱私權政策與資料處理揭露

<p align="center">
  <a href="PRIVACY.md">English</a>
  &nbsp;·&nbsp;
  <a href="PRIVACY.zh-TW.md">繁體中文</a>
</p>

**首次發布：** 2026 年 7 月 19 日

**最後更新：** 2026 年 9 月 3 日

**應用程式內政策：** /home/privacy（服務同意設定也在同一頁）

**原始碼儲存庫：** [github.com/rhosiqs/small-web-tools](https://github.com/rhosiqs/small-web-tools)（MIT 授權；可能需要 GitHub 存取權）

**維護者聯絡方式：** Rhosiqs（emailforvirtualmachine@gmail.com）

## 1. 本機優先處理

Small Web Tools 採本機優先設計。大多數文字、檔案、圖片、音訊、影片、產生的
代碼與工具結果都留在瀏覽器記憶體中。選取的媒體不會上傳給 FFmpeg 處理，檔案
檢查工具也不會將檔案內容傳送給本專案。

本機優先不代表只能離線使用。託管的應用程式、明確標示需要網路的功能、選用的
地圖嵌入、按需載入的 FFmpeg 執行環境，以及使用者選取的外部連結，都會依下列
說明使用網路。

## 2. 網路服務清單

config/network-services.json 是機器可讀的政策來源；應用程式內的
/home/privacy 路由會呈現相同的服務清單。

| 服務 | 用途與觸發條件 | 傳送資料 | 模式 | 替代方案 |
| --- | --- | --- | --- | --- |
| ExchangeRate-API | 使用者同意並開始即時轉換後取得匯率 | 標準邊緣中繼資料；供應商會收到伺服器端匯率請求 | 明確同意 | 瀏覽器端手動匯率 |
| IP 地理位置供應商 | 同意且使用者操作後查詢 | 要求的 IP 與伺服器請求中繼資料 | 明確同意 | 本機語法驗證 |
| Cloudflare Speed Test | 使用者開始延遲／下載／上傳測量 | IP、請求中繼資料與產生的測量流量 | 明確同意 | 不進行遠端測量 |
| 網站字型擷取器 | 同意並提交 URL 後掃描受限制的公開 HTML／CSS | 目標 URL；目標伺服器會收到 Function 請求中繼資料 | 明確同意 | 不掃描 |
| OpenStreetMap | 地圖同意後顯示選用的座標地圖 | 座標與標準瀏覽器請求中繼資料 | 明確同意 | 不使用 iframe，只顯示座標文字 |
| Markdown 徽章圖片 | 讀者開啟徽章圖片後，顯示所預覽 Markdown 文件指向的徽章與截圖圖片 | 圖片網址與標準瀏覽器請求中繼資料；圖片主機會得知讀者的 IP 位址 | 明確同意 | 所有圖片維持佔位顯示 |
| unpkg FFmpeg 0.12.6 | 第一次處理時下載固定版本的 JS／WASM | 只有標準瀏覽器請求中繼資料；媒體與輸出仍留在本機 | 使用時揭露 | 不使用 FFmpeg 處理 |
| Google Fonts 建議 | 使用者選取連結後開啟字型範例 | 標準導覽中繼資料 | 使用者導覽 | 不開啟連結，直接閱讀建議 |
| Google Maps | 使用者選取連結後開啟座標 | 座標與標準導覽中繼資料 | 使用者導覽 | 在本機閱讀座標 |
| Cloudflare Pages 與 Functions | 提供應用程式與同源 API | 標準邊緣請求與安全中繼資料 | 託管基礎設施 | 不使用託管應用程式 |
| 專案與作者連結 | 點選後開啟原始碼或作者資訊 | 標準導覽中繼資料 | 使用者導覽 | 留在應用程式中 |

## 3. 字型與媒體執行環境完整性

應用程式 UI 字型是自行託管的 WOFF2 檔案。初始頁面載入不會要求
fonts.googleapis.com 或 fonts.gstatic.com。網站字型擷取器的建議只有在使用者
選取連結後才可能開啟 fonts.google.com；擷取器不會預覽、代理或下載找到的字型檔案。

FFmpeg JavaScript 與 WebAssembly 資產固定使用 unpkg 上的 @ffmpeg/core 0.12.6。
執行前，瀏覽器會依據 config/ffmpeg-assets.json 中的預期位元組長度與 SHA-256
值進行驗證。若不一致，本機驗證會失敗，也不會建立可執行的 Blob URL。

## 4. 同意與瀏覽器儲存空間

/home/privacy 上的同意設定會將明確的服務選擇儲存在 small_web_tools_consent。主題、收合的導覽列
與最近路由狀態也可能使用 local storage 或 session storage。在簡易模式首頁自訂的捷徑版面
會儲存在 local storage 的 simpleLayout，且不會離開瀏覽器。本專案不加入分析追蹤器
或追蹤 Cookie。

工具狀態僅保存在 local storage，不會寫入 Cookie，因此不會附加在任何送往本站的
請求上。舊版色彩轉換器曾將自訂色盤同時寫入 customPresets Cookie。該 Cookie 已
不再寫入；既有 Cookie 只會被讀取一次，讓已儲存的色盤得以保留並移轉到
local storage，之後即予清除。

撤銷或重設同意後，會立即移除作用中的 OpenStreetMap iframe，並阻擋未來需要同意
的請求；但無法追回已經完成的請求。

## 5. 本機檔案安全

圖片、音訊、影片、Office 中繼資料、資料夾分析器、媒體分割器與其他相關本機檔案
工具使用瀏覽器檔案 API。從圖片擷取的座標不會儲存在 local storage 或記錄中。選取
Google Maps 連結時，只有使用者主動導覽才會將座標傳送給 Google。

## 6. 開放原始碼與更新

本專案採用 [MIT License](LICENSE)。政策行為可在應用程式內的服務表中檢視；若能
存取儲存庫，也可在原始碼儲存庫中檢視。

### 變更記錄

- **2026 年 7 月 19 日：** 首次發布。
- **2026 年 7 月 22 日：** 新增資料流揭露、本機替代方案與同意金鑰。
- **2026 年 7 月 23 日：** 新增應用程式內政策、機器可讀清單、自行託管 UI 字型、
  僅提供中繼資料的網站字型擷取器、經完整性驗證的 FFmpeg 揭露，以及共用的 OSM
  同意行為。
- **2026 年 7 月 30 日：** 更新維護者聯絡方式，並記錄正式的路徑式隱私權路由。
- **2026 年 9 月 3 日：** 同意設定由對話框改為文件頁面，之後併入 /home/privacy。
- **2026 年 9 月 3 日：** 揭露可編輯簡易模式版面所使用、僅存在瀏覽器的 simpleLayout 金鑰。
