# 關於 Small Web Tools

<p align="center">
  <a href="ABOUT.md">English</a>
  &nbsp;·&nbsp;
  <a href="ABOUT.zh-TW.md">繁體中文</a>
</p>

**最後更新：** 2026 年 9 月 3 日

**站內頁面：** `/home/about`

**原始碼儲存庫：** [github.com/rhosiqs/small-web-tools](https://github.com/rhosiqs/small-web-tools)（MIT 授權；可能需要 GitHub 存取權）

**維護者聯絡方式：** Rhosiqs（<emailforvirtualmachine@gmail.com>）

本文為完整版本；`/home/about` 頁面以較精簡的形式呈現相同資訊。

## 這是什麼

Small Web Tools 是一組免費的小型單一用途網頁工具。每個工具只做一件事——轉換數值、
檢視檔案、計算數量、產生內容——而且不需要帳號、不必安裝，也沒有廣告。

工具分為六大類：

- **文字**——字數統計、大小寫轉換、斜線轉換與其他文字處理。
- **開發**——編碼轉換、Markdown 與 Mermaid 預覽、程式碼預覽、GitHub HTML 片段、
  進位轉換、資料夾分析與網站字型擷取。
- **網路**——IP 查詢與網路速度測量。
- **媒體**——色彩轉換，圖片／文件／音訊／影片中繼資料，媒體分離，以及 SVG 轉 PNG。
- **生物資訊**——DNA 轉換、密碼子表與 Phred 品質分數轉換。
- **實用工具**——QR Code 與條碼、密碼產生與強度檢查、貨幣與日期計算、羅馬數字，
  以及隨機轉盤。

## 本機優先處理

大多數工具完全在瀏覽器中執行。你貼上的文字與選取的檔案都在自己的裝置上處理，
不會被上傳。

少數功能確實需要伺服器、遠端資料或下載執行階段資產，例如即時匯率、IP 查詢、
速度測試、網站字型掃描、選用的地圖預覽，以及 FFmpeg WebAssembly 執行階段。這些
功能全部宣告於 `config/network-services.json`、列在 `/home/privacy` 頁面，並記載於
[`PRIVACY.zh-TW.md`](PRIVACY.zh-TW.md)。需要授權的服務在 `/home/consent` 頁面允許
之前都保持封鎖。

## 模式、語言與偏好設定

完整模式依分類顯示所有工具，並提供日常使用者、開發者、生物資訊研究者、設計師與
學生等對象預設；簡易模式則提供較短的清單，適合快速處理日常需求。

介面提供英文與繁體中文，並有淺色與深色主題。語言、主題、側邊欄版面與同意選項
只儲存在做出該設定的瀏覽器中。

## 開放原始碼

本應用程式以 [MIT 授權條款](LICENSE)開放原始碼。原始碼、問題追蹤與版本紀錄都在
儲存庫中，歡迎回報問題或提出建議。[`CONTRIBUTING.zh-TW.md`](CONTRIBUTING.zh-TW.md)
說明開發流程，[`ARCHITECTURE.zh-TW.md`](ARCHITECTURE.zh-TW.md) 說明應用程式結構。

## 聯絡方式與相關文件

有問題、勘誤或建議，請來信 <emailforvirtualmachine@gmail.com>。安全性問題請改依
[`SECURITY.zh-TW.md`](SECURITY.zh-TW.md) 的流程回報，不要開立公開 issue。

- [`TERMS.zh-TW.md`](TERMS.zh-TW.md)——使用條款。
- [`PRIVACY.zh-TW.md`](PRIVACY.zh-TW.md)——隱私權政策與資料流揭露。
- [`SECURITY.zh-TW.md`](SECURITY.zh-TW.md)——漏洞揭露政策。
- [`LICENSE`](LICENSE)——MIT 授權條款。
