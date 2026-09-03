# Cloudflare 執行環境 SSRF 測試工具

<p align="center">
  <a href="README.md">English</a>
  &nbsp;·&nbsp;
  <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="../../../README.zh-TW.md">專案 README</a>
  &nbsp;·&nbsp;
  <a href="../../../CONTRIBUTING.zh-TW.md">貢獻指南</a>
  &nbsp;·&nbsp;
  <a href="../../../ARCHITECTURE.zh-TW.md">架構</a>
  &nbsp;·&nbsp;
  <a href="../../../PRIVACY.zh-TW.md">隱私權</a>
</p>

<p align="center">
  <a href="https://github.com/rhosiqs/small-web-tools/tags"><img src="https://img.shields.io/github/v/tag/rhosiqs/small-web-tools?sort=semver&amp;label=version" alt="版本：最新 Git 標籤"></a>
  <a href="https://github.com/rhosiqs/small-web-tools/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rhosiqs/small-web-tools/ci.yml?branch=develop&amp;label=CI" alt="CI 狀態"></a>
  <a href="https://github.com/rhosiqs/small-web-tools/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a" alt="MIT 授權條款"></a>
</p>

這個隔離的 Worker 僅用於 CR-009 的部署證據。使用測試操作者擁有的主機名稱設定
SSRF_TEST_HOSTS，並將 SSRF_TEST_TOKEN 設為 Worker secret。受控主機必須涵蓋：

- 公開回應；
- 最終目標為 loopback、私人、link-local 或 metadata 主機名稱的重新導向鏈；
- 由操作者控制的 DNS 變更／重新繫結情境。

npm run test:ssrf-runtime 會將這個測試工具與受控的重新導向目標部署到未認領的
Cloudflare 臨時預覽帳戶。測試工具只會在短暫的驗證期間公開，並需要 256 位元的
隨機 bearer token；該 token 絕不會被輸出或提交。若未被認領，Cloudflare 會刪除
臨時帳戶。驗證器會涵蓋公開控制、重新導向至 loopback／metadata、解析至 loopback
的主機名稱、同區域公開路由、混合公開／私人位址、IPv4-mapped IPv6、逾時取消，
以及公開／loopback DNS 回應反覆交替的情境。輸出只包含經遮蔽且不含秘密的證據，
以及綁定 compatibility date 與 fetch 實作版本的短期 gate metadata。若 metadata
缺失、格式錯誤、不完整、版本不符或過期，正式環境的擷取功能會保持停用。

若要使用永久帳戶執行，保留相同的驗證與允許清單控制，透過已驗證的路由或 Service
Binding 呼叫，並保留回應／記錄證據。不要將測試 fixture 指向真正的私人服務。

單元測試無法關閉 CR-009 中 DNS「檢查時」與「使用時」之間的問題。在 Cloudflare
正式執行環境執行此工具，或將任意對外連線移到能把驗證繫結至實際連線的元件之前，
該發現仍維持開放。
