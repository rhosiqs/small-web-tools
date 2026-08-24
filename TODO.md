# Project TODO

This file is the working backlog and update checklist for Small Web Tools. Keep it focused on planned work, completed maintenance, and release preparation. User-facing instructions belong in `README.md`; architecture belongs in `ARCHITECTURE.md`.

Work tracking is complementary: AI agents may create GitHub issues, prepare and
push branches, and open pull requests for some work. Not every issue, pull
request, or completed change is recorded in this file; check the repository's
GitHub Issues and Pull Requests for the complete work history. TODO.md is
intentionally maintained in English only. The project owner controls backlog
priorities and status. AI agents may append a completed GitHub Issue to the
`Completed` section only after the issue is closed and its implementation,
validation, and commit are complete, using the existing format. They must not
change the active backlog, existing entries, labels, or this update process
unless explicitly instructed.

## Labels

- `feat` — new or expanded user capability.
- `fix` — corrected behavior or regression.
- `chore` — maintenance that is not a feature, fix, or documentation-only change.
- `docs` — documentation-only work.
- `hotfix` — urgent production correction.

## Update process

Use this sequence for each meaningful update:

1. **Define the change.** Record the task below with an appropriate label and confirm the affected tools, routes, APIs, or shared components.
2. **Implement in the right place.** Keep tool registration in `src/toolRegistry.js`; use the shared `Card` and `ToolHeader` primitives for tool pages; add server functionality under `functions/api/` only when browser-only code is insufficient.
3. **Validate.** Run `npm run verify`. For layout or interaction work, also run the relevant Playwright journeys, check the affected routes at desktop and mobile widths, and review browser console errors.
4. **Update documentation.** Refresh the relevant English and Traditional Chinese companion documents for changed user behavior or structure. For a completed GitHub Issue, the project owner or an AI agent may append one entry under `Completed` after implementation, validation, and commit are complete; preserve the existing date, checklist, label, and English-only format. The project owner controls backlog priorities and status; do not turn the README into a changelog.
5. **Review and commit.** Check `git diff` and `git status`, then create a focused commit after each completed logical stage.
6. **Prepare a release when appropriate.** Confirm the version in `package.json`; create or update the git tag only as part of an agreed release. The app displays the newest git tag when one is available, otherwise it falls back to the package version.

## Active backlog

### Enhancements



### Maintenance



## Completed

### 2026-08-09

- [x] `chore` Complete the v0.10.1-beta implementation runbook: remove stale code and configuration, strengthen Knip and i18n audits, centralize shell metadata and preferences, extract audio/video metadata domains with explicit Blob URL and FFmpeg lifecycles, expand strict checks and coverage, reconcile audience curation, and enable Dependabot major-version updates.

### 2026-08-03

- [x] `feat 31` Complete the bilingual `en-US`/`zh-TW` refactor with persisted locale selection, localized shell and tool behavior, synchronized resources, and bilingual validation; released as `v0.8.0-beta`.
- [x] `docs` Synchronize the paired README, architecture, and contribution guides with the shipped bilingual runtime and its maintenance checks.

### 2026-07-30

- [x] `fix` Make the SVG-to-PNG preview surface reflect the selected transparent or white export background.
- [x] `feat` Add an accessible icon-only fullscreen preview for SVG, QR code, barcode, and VS Code image exports.
- [x] `feat 2` Add a selectable audience mode for daily users, developers, bioinformatics researchers, designers, and students.
- [x] `feat 3` Consider a simplified mode that surfaces only high-frequency tools and reduces advanced controls.
- [x] `fix 2` Slashes Converter的encode/decode作用是什麼？好像可以移除? ASCII Converter也是一樣。留auto 就好。另外，格線要對齊
- [x] `fix 3` Folder Structure Analyzer部分，我上傳了一個資料夾後，一樣還是可以輸入新的path
- [x] `fix 4` Color Code Converter & HSL Selector中的COLOR SYNC: ON/OFF按鈕要明顯一點
- [x] `fix 5` 在Image Metadata Viewer & Stripper中，為甚麼Metadata stripping is only supported for JPEG/JPG format.？其他也要
- [x] `feat 6` DNA/RNA Direction Transfer中，新增複製時可以去掉5'3'標記的選項
- [x] `chore 1` RNA codon table 中，移除All/Start/Stop按鈕
- [x] `feat 7` Date Counter 加入Time Counter 功能
- [x] `feat 8` Barcode Gen 的功能要可以把文字隱藏
- [x] `feat 9` 新增羅馬數字轉換器及對照表
- [x] `feat 10` SNP calling Mapping Quality Phred Scale transfer
- [x] `feat 11` Add SVG to PNG function
- [x] `feat 12` URL encoder/decoder (main for Chinese address transformation)
- [x] `feat 13` New feauture of the Markdown file previewer. Can paste the markdown syntax or upload the file, then use the engine to preview it. Also, can make the simple modification, also to download.
- [x] `feat 14` The code live preview and highlighter, support the multiplex language include terminal, user can choose the preview type, font and background color, also download the code. Also show the line numbers
- [x] `docs` Review the tool descriptions in the dashboard when a feature's behavior materially changes.
- [x] `docs` Keep `ARCHITECTURE.md` synchronized whenever a route, shared component, API endpoint, or dependency is added, removed, or substantially changed.

### 2026-07-28
- [x] `feat 1` Add a paste button to the source side of the Slashes, ASCII, Unicode, and Base converters. Review the existing result-copy controls at the same time for a consistent clipboard experience.

### 2026-07-26
Finish the 20260723 code review

### 2026-07-23

- [x] `fix` Completed 0723 remediation Phase 1 (C01–C05): self-hosted licensed UI fonts, metadata-only bounded Font Extractor, network-service inventory and in-app privacy route, integrity-verified on-demand FFmpeg loading, and shared OSM map consent with immediate revocation.
- [x] `test` Added focused API, integrity, consent, and Playwright network-boundary coverage; `npm run verify` and all Phase 1 browser journeys pass.

### 2026-07-18

- [x] `docs` Rewrote the README as a concise site manual.
- [x] `docs` Moved the project update process and maintenance backlog into this file.
- [x] `docs` Refreshed the architecture guide to match the active route inventory, component conventions, APIs, and documentation roles.

### 2026-07-08

- [x] `fix` Corrected the site version display so current builds no longer show a stale tag.
- [x] `fix` Restored Random Wheel spinning.
- [x] `fix` Improved Folder Analyzer handling of `.gitignore` and removed example paths from its display.
- [x] `fix` Updated dark-mode header sub-button styling.
