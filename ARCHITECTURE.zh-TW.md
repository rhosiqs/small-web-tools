# Small Web Tools 架構指南

<p align="center">
  <a href="ARCHITECTURE.md">English</a>
  &nbsp;·&nbsp;
  <a href="ARCHITECTURE.zh-TW.md">繁體中文</a>
</p>

small-web-tools 是一個使用 React 18 與 Vite 的單頁應用程式，提供以瀏覽器為基礎的
實用工具。本文件是維護目前應用程式的技術參考。路由、共用元件、API 或相依套件
變更時，請同步更新本文件。

## 文件角色

- README.md 是給網站使用者的簡短英文手冊；README.zh-TW.md 是繁體中文版本。
- CONTRIBUTING.md 是貢獻標準與 AI 指引的英文來源；CONTRIBUTING.zh-TW.md 是繁中對照檔。
- PRIVACY.md 與 PRIVACY.zh-TW.md 是成對的隱私權政策與資料流揭露。
- TODO.md 是刻意維持英文單一版本的待辦事項、已完成工作紀錄與更新流程。
- ARCHITECTURE.md 是英文架構與維護參考；本檔案是繁體中文對照檔。
- `src/i18n/` 是兩個支援 UI 地區設定及 `common`、`navigation`、`tools`、`errors`
  命名空間的來源。

本專案維護成對的英文與繁體中文說明文件。英文檔名搭配 `.zh-TW.md` 結尾的繁中檔案；
修改文件描述的行為或結構時，請同步維護兩個版本。只供 AI agent 使用的
`AGENTS.md`、`.agents/AGENTS.md` 與 `TODO.md` 刻意維持英文單一版本。

## 快速資訊

| 項目 | 內容 |
| --- | --- |
| 套件 | small-web-tools |
| 版本 | 最新的版本格式 Git 標籤；沒有 Git 中繼資料的封存檔使用 VITE_APP_VERSION 作為 fallback |
| UI 框架 | React 18 |
| 建置工具 | Vite 6 |
| 測試 | Vitest 4 + React Testing Library + jsdom |
| Lint 與型別 | ESLint 9、JSDoc，以及一般與 strict checkJs 專案 |
| 樣式 | Tailwind CSS utilities，加上 src/styles.css 的設計 token 與元件專用規則 |
| 路由 | 應用程式狀態同步至 /home 與 /simple URL 路徑，使用 React.lazy() 分割程式碼；不使用 React Router |
| 伺服器函式 | functions/api/ 中相容 Cloudflare Pages 的 handler，以及 functions/_shared/ 中的共用 helper |

建置時，scripts/resolve-version.mjs 會選取依版本排序的最新 Git 標籤。它先檢查
本機標籤；部署建置沒有本機 tag ref 時，再查詢儲存庫的遠端標籤。沒有 Git 中繼資料
的建置封存檔仍可使用 VITE_VERSION_REPOSITORY 或 package.json 中的儲存庫 URL；
VITE_APP_VERSION 是最後的明確 fallback。npm manifest 使用固定的非 release 佔位版本
0.0.0-private，這個值不會用作應用程式版本，也不會因 release 更新。CI 會取出完整
標籤歷史，而 verify 中的 npm run version:check 會確認顯示的版本由 Git 標籤或明確的
封存檔 fallback 提供。

## 儲存庫地圖

主要說明文件與根目錄設定：

- README.md／README.zh-TW.md：英文與繁中使用者手冊。
- CONTRIBUTING.md／CONTRIBUTING.zh-TW.md：工程與本機執行指南。
- PRIVACY.md／PRIVACY.zh-TW.md：隱私權政策與資料流揭露。
- TODO.md：英文待辦事項、已完成工作與更新流程。
- ARCHITECTURE.md／ARCHITECTURE.zh-TW.md：英文與繁中架構參考。
- Dockerfile.dev：供容器化 Vite 開發使用的 Node.js 22 image。
- compose.yaml：使用 bind mount 的 Vite 開發服務與具名相依套件 volume。
- .dockerignore：Docker 建置 context 與本機秘密的排除規則。
- AGENTS.md：工程 skills 的設定與 `docs/agents/` 指引入口；不建立繁中版本。
- .agents/AGENTS.md：只供 AI agent 使用的英文規則；不建立繁中版本。
- package.json：指令、相依套件與 pipeline 命令。
- jsconfig.json：JavaScript 的 TypeScript checkJs 設定。
- eslint.config.js：React、hooks 與 Cloudflare Functions 的 ESLint flat config。
- vitest.config.js：Vitest runner 設定。
- vite.config.js：Vite 6 設定、開發代理與 Rollup manualChunks。
- tailwind.config.js：映射至 CSS custom properties 的 Tailwind token。
- postcss.config.js：Tailwind 與 Autoprefixer 設定。
- index.html：Vite HTML shell 與 React mount point。

主要目錄：

- config/：network-services.json 網路服務政策來源，以及 ffmpeg-assets.json 固定的
  FFmpeg 資產大小與 SHA-256；rateLimitPolicies.js 是正式的 route、class、binding、
  limit 與 period 政策。
- .github/：Dependabot 設定與 GitHub Actions CI pipeline。
- public/：Cloudflare Pages 回應標頭、內建 WOFF2 UI 字型、授權與字型清單，以及 favicon。
- scripts/：版本、i18n、硬編碼 UI 與文件一致性檢查腳本。
- docs/：包含 `docs/agents/` 的 issue tracker、triage label 與 domain docs 規則，
  以及 Docker 開發流程與其他成對的操作文件。
- src/：React 應用程式、工具登錄表、樣式、共用 UI、工具元件與測試。
- src/components/LanguageSwitcher.jsx：桌面與行動 header 共用的地區設定選單、鍵盤導覽與焦點生命週期。
- src/components/MobileDrawer.jsx：行動導覽的焦點、inert、關閉與捲動生命週期。
- src/i18n/：地區設定解析、i18next 設定、持久化，以及成對的 en-US／zh-TW 命名空間資源。
- functions/：共用無伺服器工具與 Cloudflare Pages API handler。
- workers/：rate-limiter Worker。
- test/：SSRF 與其他整合測試 fixture。
- e2e/：Playwright 瀏覽器流程。

dist/ 是 npm run build 產生的目錄，刻意被忽略。

## 型別檢查邊界

JavaScript 遷移使用三個明確的 TypeScript checkJs 專案。`jsconfig.json` 是廣泛的
非 strict baseline；`jsconfig.domain.json` 保留既有的狹窄領域／共用 helper 邊界；
`jsconfig.ui.json` 是漸進式共用 UI 邊界，啟用 `strictNullChecks`，涵蓋
`LanguageSwitcher.jsx`、桌面 header／分類／footer 元件、`MobileDrawer`、路由／標題／
持久化 hooks、共用分類定義、抽離後的音訊／影片中繼資料領域，以及其純 route／mode
相依項。CI 中的 `npm run typecheck` 會執行三個
專案。新增排除必須維持最少並加以記錄；擴大 UI 邊界時必須在同一變更修正所有
新揭露的錯誤。

## 應用程式架構

### 入口與 shell

src/main.jsx 掛載 App 並匯入 src/styles.css。

src/App.jsx 負責應用程式 shell：

- src/toolRouteMetadata.js 是唯一的路由中繼資料來源。側邊欄、桌面導覽、儀表板卡片、
  active title、footer links、靜態 layout 與路由測試都從此衍生；src/toolRegistry.js
  只把這些中繼資料與 lazy component loader 結合。
- 登錄表 aliases 保留舊書籤；tool-officemeta 會解析為 tool-docmeta。
- src/categoryDefinitions.jsx 定義六個共用呈現群組與圖示：Text、Developer、Network、
  Media、Bioinfo 與 Utilities。
- activeTool 從 /home[/&lt;audience&gt;]/&lt;tool-slug&gt; 或 /simple/&lt;tool-slug&gt; 初始化，並同步回路徑。
- toolMode 從經驗證的 /home 或 /simple 路徑初始化。工作區路徑會留在 URL 中，
  路徑導覽則改變工具。
- useShellPersistence 集中管理 active-tool session state、theme 與 sidebar 持久化；
  useDocumentTitle 在儲存空間不可用時仍獨立管理頁面標題。
- renderActiveTool() 解析目前的登錄表項目並渲染其 lazy component。privacy 路由已登錄，
  但不列入工具目錄。

Shell 提供可回應式的桌面側邊欄、行動抽屜、頂端導覽、麵包屑、footer、搜尋、主題控制項
與置中的工具工作區。

src/components/MobileDrawer.jsx 負責窄螢幕抽屜邊界。關閉時會卸載抽屜；開啟時會移入並
限制焦點、讓被遮蔽的 shell inert、鎖定 body 捲動，並支援 Escape、overlay、明確關閉
與路由選取後關閉，最後將焦點還給開啟按鈕。

`src/components/LanguageSwitcher.jsx` 由 `App.jsx` 直接渲染於行動與桌面 header。它是地區設定選項、選單狀態、鍵盤導覽與焦點復原的共用負責元件；Simple 工作區不渲染桌面控制項。

### 國際化執行階段

`src/i18n/index.js` 以 `react-i18next` 初始化 `i18next`，載入
`src/i18n/locales/en-US/` 與 `src/i18n/locales/zh-TW/` 下成對的
`common`、`navigation`、`tools`、`errors` 命名空間。English (`en-US`) 是預設與
fallback，繁體中文 (`zh-TW`) 是第二個支援地區設定。

初始地區設定按固定順序解析：有效的 `small-web-tools.locale` 儲存值優先，其次是
瀏覽器偏好的語言，最後使用 `en-US`。`src/components/LanguageSwitcher.jsx` 呼叫
`changeLocale()`，更新 `document.documentElement.lang`，並只儲存正規化後的支援地區設定；
儲存失敗不會阻止記憶體中的切換。

路由 ID、URL 路徑、工具 ID、檔案副檔名、協定名稱等互通性識別碼保持穩定。
`toolRegistry.js` 將這些識別碼與標題、描述、tooltip、搜尋中繼資料分離；英文搜尋詞
仍會作為 fallback。`sortLocalizedTools()` 使用目前地區設定的 `Intl.Collator`，工具則
使用 `Intl` 以地區設定格式化讀者可見的數字、日期與時間。UI 地區設定不會翻譯使用者
內容，也不會改變內容演算法。

每次 UI 字串變更都必須同步兩棵地區設定資源樹。`npm run i18n:check` 會檢查 key
對齊、重複 key、非空翻譯與 interpolation 對齊；`npm run i18n:audit` 會掃描 JSX
尋找未審查的使用者可見字串。重點測試位於 `src/tests/i18n.test.js`、
`src/tests/i18nValidation.test.js`、`src/tests/i18nHardcodedUi.test.js` 與
`src/tests/wordCounterLocale.test.js`。

### Audience 與 Simple 工作區

src/toolModes.js 定義完整儀表板與五個使用者群組：一般使用者、開發人員、生物資訊
研究人員、設計師與學生。獨立的 SIMPLE_WORKSPACE 定義八個高頻工具。應用程式層級的
篩選會一致套用到儀表板卡片、側邊欄與搜尋；Simple 側邊欄只保留必要工具，但 Simple
搜尋可以開啟任何已登錄工具。

AudienceSwitcher.jsx 為完整首頁與五個使用者群組渲染分段控制項。HomeGrid.jsx 將它
放在介紹旁，保留完整的分類儀表板，並渲染平面的使用者群組建議。SimpleHome.jsx
在縮減後的 shell 中提供所有工具搜尋與八個精簡捷徑。路由使用
/home[/&lt;audience&gt;][/&lt;tool-slug&gt;] 與 /simple[/&lt;tool-slug&gt;]；舊版 /home/simple
位址會重新導向至 /simple。重點測試位於 toolModes.test.js、homeGrid.test.jsx、
audienceSwitcher.test.jsx 與 simpleHome.test.jsx。

Mermaid 屬於 developer audience。其他可導覽工具都必須出現在至少一個精選工作區，
或在 `INTENTIONAL_CURATED_EXCLUSIONS` 中保留明確理由；`toolModes.test.js` 會執行此規則。
App shell、lazy route、持久化、工作區導覽與語言切換的整合覆蓋位於 `App.test.jsx`。

### 共用工具頁面契約

每個路由工具頁面都使用由 Image Metadata 建立的共用視覺契約：

1. 使用 variant="tool" 的 Card 作為頁面容器。
2. 頁面識別恰好渲染一個 ToolHeader 標題。
3. 頁面層級描述不要放進 ToolHeader；輔助文字放在需要它的功能內。
4. 保留共用桌面卡片間距（p-6、gap-4），並讓 styles.css 的行動 .tool-card 規則
   處理窄螢幕。

src/components/ui/AutoDetectConverter.jsx 為 Slashes、ASCII、Unicode 與 URL 轉換器
實作此契約。Slashes 與 ASCII 只顯示自動方向偵測；Unicode 與 URL 在方向可能不明確時
保留明確的 encode/decode 控制。

### 樣式與主題

src/styles.css 定義 --bg-app、--bg-card、--text-main、--accent 與 --border-color
等 light／dark CSS custom properties。tailwind.config.js 將這些 token 暴露為 Tailwind
色彩、陰影與字型 utilities。

Inter、JetBrains Mono、Plus Jakarta Sans 與 TASA Orbiter 從 public/fonts/ 提供；版本、
子集與 OFL 授權檔記錄於 public/fonts/MANIFEST.md 與
public/fonts/MANIFEST.zh-TW.md。應用程式不會自動要求 Google Fonts。

優先使用共用 primitives 與既有設計 token。只有真正共用的行為或元件專用樣式無法以
既有 utilities 清楚表達時，才加入全域 CSS。

## 路由清單

| 路由 ID | 導覽標籤 | 元件 | 分類 |
| --- | --- | --- | --- |
| tool-home | 儀表板 | HomeGrid.jsx | 儀表板 |
| tool-wc | 文字計數器 | WordCounter.jsx | 文字 |
| tool-casing | 大小寫切換器 | CasingSwitcher.jsx | 文字 |
| tool-slash | 斜線轉換器 | SlashesConverter.jsx | 開發 |
| tool-ascii | ASCII 轉換器 | AsciiConverter.jsx | 開發 |
| tool-unicode | Unicode 轉換器 | UnicodeConverter.jsx | 開發 |
| tool-url | URL 編碼與解碼器 | UrlEncoderDecoder.jsx | 開發 |
| tool-markdown | Markdown 預覽器 | MarkdownPreviewer.jsx | 開發 |
| tool-mermaid | Mermaid 轉換器 | MermaidConverter.jsx | 開發 |
| tool-code-preview | VS Code 預覽器 | CodePreviewer.jsx | 開發 |
| tool-fontextractor | 網站字型擷取器 | WebsiteFontExtractor.jsx | 開發 |
| tool-base | 進位轉換器 | BaseConverter.jsx | 開發 |
| tool-folder-analyzer | 資料夾分析器 | FolderAnalyzer.jsx | 開發 |
| tool-iplookup | IP 查詢 | IpLookup.jsx | 網路 |
| tool-speedtest | 網路速度測試 | NetworkSpeedTest.jsx | 網路 |
| tool-color | 色彩轉換器 | ColorConverter.jsx | 媒體 |
| tool-imgmeta | 圖片中繼資料 | ImgMeta.jsx | 媒體 |
| tool-docmeta | 文件中繼資料 | DocMeta.jsx | 媒體 |
| tool-audiometa | 音訊中繼資料 | AudioMeta.jsx | 媒體 |
| tool-videometa | 影片中繼資料 | VideoMeta.jsx | 媒體 |
| tool-mediasplit | 媒體分割器 | MediaSeparator.jsx | 媒體 |
| tool-svg-png | SVG 轉 PNG | SvgToPngConverter.jsx | 媒體 |
| tool-dna | DNA/RNA 轉換器 | DnaConverter.jsx | 生物資訊 |
| tool-codon | 密碼子表 | CodonTable.jsx | 生物資訊 |
| tool-phred | Phred 尺度轉換器 | PhredScaleConverter.jsx | 生物資訊 |
| tool-barcode | 條碼產生器 | QrBarcodeGenerator.jsx（barcode 分頁） | 工具 |
| tool-currency | 貨幣轉換器 | CurrencyCounter.jsx | 工具 |
| tool-date | 日期與時間計算器 | DateCounter.jsx | 工具 |
| tool-roman | 羅馬數字轉換器 | RomanNumeralConverter.jsx | 工具 |
| tool-password | 密碼產生器 | PasswordGenerator.jsx（generate 分頁） | 工具 |
| tool-pwstrength | 密碼強度 | PasswordGenerator.jsx（check 分頁） | 工具 |
| tool-qrcode | QR Code 產生器 | QrBarcodeGenerator.jsx（qr 分頁） | 工具 |
| tool-qrbarcodescan | QR Code 與條碼掃描器 | QrBarcodeScanner.jsx | 工具 |
| tool-wheel | 隨機轉盤 | RandomWheel.jsx | 工具 |
| privacy | 隱私權與網路服務 | PrivacyPolicy.jsx | 政策（不在工具目錄） |

## 元件群組

### 共用 UI：src/components/ui/

| 檔案 | 角色 |
| --- | --- |
| Card.jsx | 工具頁面與儀表板卡片的共用容器。 |
| ToolHeader.jsx | 路由工具唯一的頁面識別元件。 |
| Button.jsx | 共用按鈕變體與尺寸。 |
| FieldInput.jsx | 有標籤的 input 與 textarea helper。 |
| AutoDetectConverter.jsx | 共用雙面板自動轉換介面。 |
| ToggleSwitch.jsx、Spinner.jsx、ResultDisplay.jsx | 可重用控制項與回饋 UI。 |

ExternalMapPreview.jsx 是 IP Lookup 與 Image Metadata 共用的 OpenStreetMap 同意邊界。
它在本機渲染座標文字，只有 osm 同意啟用時才建立 iframe，撤銷或重設後立即移除 iframe。

### Markdown 預覽器

MarkdownPreviewer.jsx 提供瀏覽器本機編輯器、.md／.markdown 上傳、即時預覽、格式化
helper 與 Markdown 下載。其領域模組會將常見區塊與行內語法解析為安全的 React token；
不會渲染 raw HTML 與外部圖片，並丟棄不安全的 URL scheme。來源行中繼資料讓可獨立捲動
的編輯器與預覽區能雙向對齊，不會折疊 fenced-code 內容。重點解析器與互動測試位於
markdownDomain.test.js 與 markdownPreviewer.test.jsx。

### VS Code 預覽器

CodePreviewer.jsx 提供單一瀏覽器本機、VS Code 風格的編輯表面，醒目顯示區與文字輸入
位於同一視窗。它支援 26 種可選語言模式（包含 Bash／Shell）、本機檔案輸入、隨選
外觀對話框（System、Light、Dark）、accent／背景／前景／程式碼字型控制、行號、來源
檔案下載、剪貼簿複製，以及不執行程式或上傳伺服器的 lazy PNG 匯出。語言登錄表、檔名
推斷、對比選擇與醒目顯示 helper 位於 CodePreviewer/lib/；重點領域與互動測試位於
codePreviewDomain.test.js 與 codePreviewer.test.jsx。

### 媒體分割器

MediaSeparator.jsx 是頁面元件；useMediaSeparator.js 管理佇列狀態與動作。
mediaSeparatorEngine.js 只會在需要時下載固定的 FFmpeg 0.12.6 JavaScript 與 WebAssembly
資產，依 config/ffmpeg-assets.json 的位元組長度與 SHA-256 驗證後，再透過 Blob URL 載入。
佇列項目、波形與格式選擇元件保持 UI 模組化。

### 檔案中繼資料工具

ImgMeta.jsx、DocMeta.jsx、AudioMeta.jsx 與 VideoMeta.jsx 在瀏覽器中解析使用者選取的
檔案。它們支援工具專用的檢查、比較、匯出或中繼資料移除流程，不會將檔案送過此應用程式。

音訊解析、格式偵測、中繼資料剝除、tag label 與 URL ownership 位於
`src/components/AudioMeta/lib/`。MP4／MOV 解析、codec／色彩映射、timecode 轉換、
瀏覽器 probing，以及序列化 FFmpeg 音軌抽取服務位於 `src/components/VideoMeta/lib/`。
抽取服務負責唯一虛擬檔名、progress listener 移除、虛擬檔案刪除、取消檢查與引擎終止；
`useObjectUrlRegistry` 則負責 preview、衍生輸出與下載 Blob URL。聚焦測試位於
`audioMetadataDomain.test.js` 與 `videoMetadataDomain.test.js`。

純文件格式化／解析 helper 位於 src/components/DocMeta/lib/。QR／barcode 編碼規則與
codon 輸入／篩選／呈現規則位於各自的 src/components/&lt;Tool&gt;/lib/ 目錄。聚焦覆蓋率
包含 documentMetadataDomain.test.js、qrBarcodeDomain.test.js 與 codonDomain.test.js；
DNA/RNA 複製格式位於 dnaCopy.test.js，時間差位於 timeDomain.test.js，羅馬數字位於
romanDomain.test.js，Phred 轉換位於 phredDomain.test.js，消毒 SVG 解析／匯出大小位於
svgDomain.test.js，URL 百分比編碼位於 urlDomain.test.js。轉換器模式、資料夾選擇器、
Color Sync 與圖片剝離說明回歸由 converterClipboard.test.jsx 與 enhancementUi.test.jsx 覆蓋。

## API 與開發中介軟體

相容 Cloudflare Pages 的 handler 位於 functions/api/：

| 端點 | 檔案 | 用途 |
| --- | --- | --- |
| GET /api/iplookup?ip=&lt;address&gt; | iplookup.js | 查詢備援 IP 地理位置供應商並正規化回應。 |
| POST /api/extract-fonts | extract-fonts.js | 僅同源、受速率限制地掃描有大小上限的公開 HTML／CSS；回傳宣告中繼資料與截斷資訊，不抓取字型檔案。 |
| GET /api/exchange-rates | exchange-rates.js | 在瀏覽器取得同意後抓取並正規化即時 USD 匯率。 |

指定的 *.test.js 測試位於 functions/api/tests/。vitest.config.js 將
functions/api/** 納入覆蓋率門檻，與共用 server 與 client library 使用相同門檻。

functions/_shared/requestPolicy.js 管理 Font Extractor 的 4 KiB 請求上限與聚合工作
限制（HTML／CSS／總位元組、樣式表數量、import 深度、face 數量、並行數與 deadline）。
functions/_shared/fontExtractionCapability.js 會在短期 runtime 證據未符合 Cloudflare
compatibility date、fetch 實作版本與必要情境集合時，讓正式環境擷取功能故障關閉。
字型擷取會把 HTML `rel` 視為不分大小寫的 token 清單，並依宣告順序回傳每個
font-face source list 中所有遠端 `url()` 候選。`local()` 與 data source 會被略過，
但不會遮蔽後續遠端 fallback；候選會依正規化絕對 URL 與 face metadata 去重。
vite.config.js 只為 IP lookup（/api/iplookup）提供本機 Vite 代理。測試其他 Function
時使用 Cloudflare Pages 本機執行環境。

正式環境 rate limit 由 workers/rate-limiter/ 中的 service-bound Worker 執行；根目錄
wrangler.jsonc 以 RATE_LIMITER_SERVICE 將 Pages Functions 綁定至它。完整本機整合測試時，
另外啟動該 Worker。npm run platform:integration 會以隔離本機狀態啟動 Pages 與 Worker
設定，證明並行請求受到設定的平台限制，也證明缺少服務時會安全失效。程序內 limiter
只在明確的 development mode 可用；正式環境在缺少綁定時會安全失效。
config/rateLimitPolicies.js 是 Pages helper、Worker、本機 integration 與設定驗證共同使用的
正式 route-policy 來源。Wrangler 因平台需求保留的數值宣告會與它比對；未知、孤立、缺失
或數值不符的 binding 都會讓 platform:check 失敗。
Pages 端 deadline 會綁定至 service-binding 的 `Request.signal`，因此逾時會限制 caller
工作並把取消傳遞至 Worker runtime，同時維持相同的故障關閉 503 回應。

test/integration/ssrf-worker/ 與 test/integration/ssrf-target-worker/ 是針對對外抓取
邊界的隔離 Cloudflare runtime fixture。只有預期進行臨時 Cloudflare 部署時才執行
npm run test:ssrf-runtime；它使用未認領、會自動到期的預覽帳戶，不會輸出 token 或認領 URL。
成功輸出包含綁定 compatibility date 與 fetch 實作版本、有效期 30 天的機器可讀 gate
metadata；缺失、不符、不完整或過期時，正式環境擷取功能維持停用。
測試工具的英文與繁中說明分別位於該目錄的 README.md 與 README.zh-TW.md。

### 本機完成與延後的 Cloudflare 工作

C06–C16 儲存庫與本機執行環境的補救範圍已於 2026-07-26 接受為完成。正式部署、
Cloudflare 即時 SSRF 證據與分階段 HSTS 觀察是擁有者延後的營運工作，不是完成本機
開發的前置條件。若之後回報 Cloudflare 開發或部署錯誤，依情況使用
npm run platform:check、npm run platform:integration 與選擇性執行的
npm run test:ssrf-runtime 證據流程；不要因為存在這些指令就推論已獲得部署許可。

Wrangler 設定檔（wrangler.jsonc、workers/rate-limiter/wrangler.jsonc 與整合 fixture
設定）受版本控制，但本機 Wrangler 狀態與憑證不受版本控制：

- .wrangler/、.wrangler-*/ 與 .tmp-*/ 是可丟棄的執行環境／記錄／狀態目錄，且已忽略。
- .dev.vars 與 .dev.vars.* 已忽略，因為可能包含秘密；.dev.vars.example 仍受追蹤，
  作為安全範本。
- dist/、coverage/、.playwright-cli/、test-results/ 與 playwright-report/ 是本機產生
  且已忽略的檔案。
- `.scratch/security/` 保存本機私人安全性 issue 紀錄並已忽略；安全性相關工作不得發布
  到 GitHub Issues。
- code_reviews/ 包含被忽略的本機審查工作紀錄。它們是有日期的歷史快照，不受版本控制，
  也不是目前狀態或正式指引。

### 儲存庫衛生

需要建置、測試、操作或維護的根目錄檔案與目錄都保留在版本控制中：

- src/、public/、functions/、workers/、config/、scripts/、test/ 與 e2e/ 包含應用程式
  程式碼、執行資產、政策、自動化或驗證 fixture。
- package.json、package-lock.json、.nvmrc、index.html，以及 ESLint、JavaScript、Knip、
  Playwright、PostCSS、Tailwind、Vite、Vitest 與 Wrangler 設定檔定義可重現的本機開發
  與驗證。
- .github/ 包含 CI 與相依套件維護設定；.agents/AGENTS.md 包含儲存庫範圍的開發指引，
  根目錄 AGENTS.md 則將工程 skills 指向 `docs/agents/` 中的規則。
- README、CONTRIBUTING、ARCHITECTURE 與 PRIVACY 的英文／繁中說明檔，以及 TODO.md、
  LICENSE，是維護中的專案文件或法律資料。
- .dev.vars.example 是安全、非秘密的本機執行環境文件；實際 .dev.vars* 仍維持忽略。

編輯器狀態、相依套件安裝、產生輸出、測試報告、本機 Cloudflare 狀態、私人環境檔案、
外來暫存資料與審查產物只存在本機工作區，並由 .gitignore 覆蓋。

Folder Analyzer 使用瀏覽器資料夾選擇器，絕不接受任意本機路徑。掃描後可以重新開啟
重設的選擇器加入另一個資料夾，包括先前已選的路徑，不會清除目前分析。

Image Metadata 不重新編碼就移除 JPEG 中繼資料。PNG、WebP 與其他瀏覽器可解碼格式會
透過瀏覽器本機的隱私安全重新編碼移除中繼資料；在支援時保留 PNG／WebP 輸出，其他
解碼格式則 fallback 至 PNG。Canon CR3 只提供檢查，因為瀏覽器無法安全重建其 RAW
影像資料。

Color Converter 提供高對比的 Color Sync pressed toggle。

## 地區設定相關行為

所選的介面語系只控制標籤與提供給讀者的格式，不會推定使用者內容的語言。字數統計器
會檢查每次輸入：CJK 字元以每分鐘 500 字估算，非 CJK 文字以每分鐘 200 字估算；混合
內容會合併兩種估算。環境支援時使用 `Intl.Segmenter` 判定字素與句子邊界，並以
`Intl.NumberFormat` 格式化顯示結果。

此 beta 的密碼分析仍使用隨附的英文 `zxcvbn` 字典進行模式偵測。介面會依數值分數映射
為在地化的標籤、通用回饋與破解時間區間，因此介面翻譯與分析字典彼此獨立。未來可加入
特定語言字典以改善辨識，而不需改變介面契約。編碼器、檢查碼、密碼子查詢、媒體解析與
密碼學隨機抽選等技術演算法維持語言中立；提供給讀者的數字、日期、單位與複數訊息則使用
平台 `Intl` API 或 i18next 插值。

## 網路服務政策

config/network-services.json 是外部供應商、網域、用途、觸發條件、傳送資料、同意模式、
替代方案與政策連結的機器可讀來源。src/lib/thirdPartyServices.js、同意管理器與正式的
/home/privacy 路由都使用這份清單。舊版 hash 位址只為向後相容的重新導向而接受。
verify 中的 scripts/check-external-hosts.mjs 會在正式來源主機名稱未宣告時失敗。

## 相依套件

| 套件 | 用途 |
| --- | --- |
| react、react-dom | React 渲染。 |
| @vitejs/plugin-react、vite | 開發伺服器與正式建置。 |
| i18next、react-i18next | 同步地區設定資源、React 翻譯 hooks、fallback 與語言切換。 |
| vitest、@vitest/coverage-v8 | 單元／整合 runner 與覆蓋率門檻。 |
| eslint、React lint plugins | 靜態分析規則與不增加的警告預算。 |
| wrangler | 固定的 Cloudflare Pages／Worker 設定驗證與本機整合執行環境。 |
| tailwindcss、postcss、autoprefixer | Utility CSS 建置 pipeline。 |
| exifreader | 圖片中繼資料解析。 |
| jszip | 通過 archive-limit preflight 後的 Office 文件中繼資料解析與封存處理。 |
| html5-qrcode | 相機與檔案式 QR／barcode 掃描。 |
| qrcode、jsbarcode | QR 與 barcode 產生。 |
| highlight.js | Code Live Preview 工具的瀏覽器本機語法醒目顯示。 |
| html-to-image | 樣式化程式碼預覽的 lazy 瀏覽器本機 PNG 匯出。 |
| @ffmpeg/ffmpeg | 使用完整性驗證遠端 core 資產的用戶端媒體分割。 |
| @zxcvbn-ts/core 與 language packages | 只在密碼路由載入、具有模式辨識的密碼強度分析。 |
| ignore | Folder Analyzer 的相容標準 .gitignore 比對。 |
| ipaddr.js | 標準 IPv4／IPv6 解析與公開位址驗證。 |

## 本機開發

支援下方的主機流程，以及
[`docs/docker-development.zh-TW.md`](docs/docker-development.zh-TW.md) 中的容器化 Vite
流程。Docker 流程使用 `Dockerfile.dev` 與 `compose.yaml`，並刻意與 `npm run dev`
相同，只模擬 `/api/iplookup` Function。

```bash
npm install --global npm@10.9.2
npm ci
npm run dev
npm run build
npm run i18n:check
npm run i18n:audit
npm run deadcode:check
npm run verify
npm run test:e2e
npm run docs:check
npm run preview
```

支援 Node.js 22 與 Node.js 24。使用 package.json 的 packageManager 欄位固定的
npm@10.9.2；CI 會安裝並驗證該精確版本。npm run verify 是基本門檻：Git 標籤版本解析、
不增加的 ESLint 警告預算、一般與 strict checkJs、覆蓋率門檻、正式建置、套件大小、
靜態標頭政策、外部主機清單、Cloudflare 拓撲與文件一致性。CI 另外執行相依套件檢查、
Playwright 流程與 npm audit。

覆蓋率 gate 納入 `App.jsx`、共用分類定義與抽離後的音訊／影片領域，並設定各邊界門檻。
Knip 會以 dependency-only 與完整 dead-code 模式執行，明確列出應用程式、Functions、
Worker、script、test、integration 與瀏覽器流程入口。

## 新增或修改工具

1. 在 src/components/ 下建立或更新元件。
2. 在 src/toolRegistry.js 加入或修改唯一的登錄表項目。
3. 遵循共用 Card 加單一 ToolHeader 的 layout 契約。
4. 重用既有 UI primitives 與 theme tokens。
5. 只有瀏覽器端不足時才加入 API handler；若本機開發需要該端點，在 vite.config.js
   中同步加入。
6. 加入或更新相符的 `en-US` 與 `zh-TW` 命名空間鍵，包括標籤、placeholder、錯誤、
   通知與輔助文字；路由 ID 與技術識別碼保持穩定。
7. 更新路由清單、本文件受影響的段落，以及英文架構指南的繁中對照檔。
8. 建置專案，並在兩個支援的地區設定下，以桌面與行動寬度驗證變更後的路由。

## 文件維護

使用者行為變更時，更新 README.md 與 README.zh-TW.md 中相應的內容。實作結構變更時，
更新 ARCHITECTURE.md 與本檔案。工程或資料流政策變更時，同步更新 CONTRIBUTING 與
PRIVACY 的英文／繁中對照檔。地區設定變更還要同步兩棵資源樹，並執行
`i18n:check`、`i18n:audit` 與 `docs:check`。TODO.md 維持英文單一版本；依照
TODO.md 中的驗證與提交流程記錄工作。若工作由 AI agent 建立 GitHub Issue 或 Pull
Request 追蹤，也要以 GitHub 紀錄作為補充，不要假設所有變更都會出現在 TODO.md。
