# Privacy Policy & Data Processing Disclosure

<p align="center">
  <a href="PRIVACY.md">English</a>
  &nbsp;·&nbsp;
  <a href="PRIVACY.zh-TW.md">繁體中文</a>
</p>

**First Published:** July 19, 2026

**Last Updated:** September 3, 2026

**In-app policy:** `/home/privacy` (the same page carries the service consent settings)

**Source repository:** [github.com/rhosiqs/small-web-tools](https://github.com/rhosiqs/small-web-tools) (MIT License; GitHub access may be required)

**Maintainer Contact:** Rhosiqs (<emailforvirtualmachine@gmail.com>)

## 1. Local-first processing

Small Web Tools is local-first. Most text, files, images, audio, video, generated codes, and tool results stay in browser memory. Selected media is not uploaded for FFmpeg processing, and file-inspection tools do not send file bodies to this project.

Local-first does not mean offline-only. The hosted application, named network-dependent features, optional map embeds, the on-demand FFmpeg runtime, and user-selected external links use the network as disclosed below.

## 2. Network-service inventory

`config/network-services.json` is the machine-readable policy source of truth. The in-app `/home/privacy` route renders the same service inventory.

| Service | Purpose and trigger | Data transmitted | Mode | Fallback |
| --- | --- | --- | --- | --- |
| ExchangeRate-API | Live rates after the user grants consent and starts a live conversion | Standard edge metadata; the provider receives a server-side rates request | Explicit consent | Manual browser-side rate |
| IP geolocation providers | Lookup after consent and user action | Requested IP and server request metadata | Explicit consent | Local syntax validation |
| Cloudflare Speed Test | User-started latency/download/upload measurement | IP, request metadata, and generated measurement traffic | Explicit consent | No remote measurement |
| Website Font Extractor | Bounded public HTML/CSS scan after consent and URL submission | Target URL; target servers receive Function request metadata | Explicit consent | Do not scan |
| OpenStreetMap | Optional coordinate map after map consent | Coordinates and standard browser request metadata | Explicit consent | Coordinate text without an iframe |
| Markdown badge images | Badge and screenshot images in a previewed Markdown document, after the reader turns badge images on | Image URL and standard browser request metadata; the image host learns the reader IP address | Explicit consent | Every image stays a placeholder |
| unpkg FFmpeg 0.12.6 | Download pinned JS/WASM on the first processing action | Standard browser request metadata only; media and outputs remain local | Point-of-use disclosure | Do not process with FFmpeg |
| Google Fonts recommendations | Open a specimen after the user selects a link | Standard navigation metadata | User navigation | Read the recommendation without opening it |
| Google Maps | Open coordinates after the user selects a link | Coordinates and standard navigation metadata | User navigation | Read coordinates locally |
| Cloudflare Pages and Functions | Deliver the app and same-origin APIs | Standard edge request and security metadata | Hosting infrastructure | No hosted app |
| Project and author links | Open source or author information after a click | Standard navigation metadata | User navigation | Remain in the app |

## 3. Fonts and media runtime integrity

The application UI fonts are self-hosted WOFF2 files. Initial page load does not request `fonts.googleapis.com` or `fonts.gstatic.com`. Font Extractor recommendations may open `fonts.google.com` only after a user selects a link; the extractor does not preview, proxy, or download discovered font files.

The FFmpeg JavaScript and WebAssembly assets remain pinned to `@ffmpeg/core` 0.12.6 on unpkg. Before execution, the browser verifies their expected byte lengths and SHA-256 values from `config/ffmpeg-assets.json`. A mismatch fails locally without creating an executable Blob URL.

## 4. Consent and browser storage

The consent settings on `/home/privacy` store explicit service choices under `small_web_tools_consent`. Theme, collapsed navigation, and recent route state may also use local or session storage. A Simple mode shortcut layout customized on the Simple home page is stored under `simpleLayout` in local storage and never leaves the browser. The project does not add analytics trackers or tracking cookies.

Tool state stays in local storage and is never written to a cookie, so it is not attached to any request to the origin. Earlier versions of the Color Converter also mirrored a custom palette into a `customPresets` cookie. That cookie is no longer written; an existing one is read once so a saved palette survives, migrated to local storage, and then cleared.

Revoking or resetting consent immediately removes an active OpenStreetMap iframe and blocks future consent-gated requests. It cannot recall a request that already completed.

## 5. Local file safety

Image, audio, video, Office metadata, Folder Analyzer, Media Splitter, and related local-file tools use browser file APIs. Coordinates extracted from an image are not stored in local storage or logs. Selecting a Google Maps link sends those coordinates to Google only through the user-initiated navigation.

## 6. Open source and updates

The project is licensed under the [MIT License](LICENSE). Policy behavior can be
reviewed in the in-app service table and, when repository access is available, in
the source repository.

### Change log

- **July 19, 2026:** Initial publication.
- **July 22, 2026:** Added data-flow disclosure, local fallbacks, and consent keys.
- **July 23, 2026:** Added the in-app policy, machine-readable inventory, self-hosted UI fonts, metadata-only Font Extractor, integrity-verified FFmpeg disclosure, and shared OSM consent behavior.
- **July 30, 2026:** Updated the maintainer contact and documented the canonical path-based privacy route.
- **September 3, 2026:** Moved consent settings from a dialog to a document page, then merged that page into `/home/privacy`.
- **September 3, 2026:** Disclosed the browser-only `simpleLayout` key behind the editable Simple mode layout.
