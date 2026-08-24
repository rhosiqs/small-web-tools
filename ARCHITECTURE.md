# Architecture Guide: Small Web Tools

<p align="center">
  <a href="ARCHITECTURE.md">English</a>
  &nbsp;·&nbsp;
  <a href="ARCHITECTURE.zh-TW.md">繁體中文</a>
</p>

`small-web-tools` is a React 18 and Vite single-page application containing browser-based utility tools. This document is the technical reference for maintaining the current application. Keep it updated when routes, shared components, APIs, or dependencies change.

The project maintains paired English and Traditional Chinese explanatory guides.
Companion files use the `.zh-TW.md` suffix; `TODO.md` remains the English-only
backlog. Keep the two language versions synchronized when documented behavior or
structure changes.

## Documentation roles

- `README.md` is the brief English manual for people using the site; `README.zh-TW.md`
  is its Traditional Chinese translation.
- `CONTRIBUTING.md` is the English source for contribution standards and AI guidelines;
  `CONTRIBUTING.zh-TW.md` is its Traditional Chinese companion.
- `TODO.md` is the maintained English-only backlog, completed-work log, and update process.
- `ARCHITECTURE.md` is this English architecture and maintenance reference;
  `ARCHITECTURE.zh-TW.md` is its Traditional Chinese companion.
- `PRIVACY.md` and `PRIVACY.zh-TW.md` are the paired privacy policy and data-flow disclosures.
- `src/i18n/` is the source of truth for the two supported UI locales and their
  `common`, `navigation`, `tools`, and `errors` namespaces.

## Quick facts

| Package | `small-web-tools` |
| --- | --- |
| Version | Latest version-formatted Git tag; `VITE_APP_VERSION` fallback for archives without Git metadata |
| UI framework | React 18 |
| Build tool | Vite 6 |
| Testing | Vitest 4 + React Testing Library + jsdom |
| Linting & Types | ESLint 9, JSDoc + normal and strict checkJs projects |
| Styling | Tailwind CSS utilities plus `src/styles.css` design tokens and component-specific rules |
| Routing | In-app state synchronized to `/home` and `/simple` URL paths with `React.lazy()` code splitting; no React Router |
| Server functions | Cloudflare Pages-compatible handlers in `functions/api/` and shared helpers in `functions/_shared/` |

At build time, `scripts/resolve-version.mjs` selects the newest version-sorted Git tag. It first checks local tags, then queries the repository's remote tags when a deployment build has no local tag refs. Build archives without Git metadata can still use `VITE_VERSION_REPOSITORY` or the repository URL in `package.json`; `VITE_APP_VERSION` remains the final explicit fallback. The npm manifest uses the fixed non-release placeholder `0.0.0-private`, which is never used as the application version or updated for releases. CI checks out full tag history, and `npm run version:check`, included in `verify`, confirms that a Git tag or explicit archive fallback supplied the displayed version.

## Repository map

The maintained documentation pairs are README.md/README.zh-TW.md,
CONTRIBUTING.md/CONTRIBUTING.zh-TW.md, ARCHITECTURE.md/ARCHITECTURE.zh-TW.md,
and PRIVACY.md/PRIVACY.zh-TW.md. TODO.md is intentionally English-only.
Supporting explanatory documents are public/fonts/MANIFEST.md with its
Traditional Chinese companion, the two SSRF harness READMEs, and the
English-only AI agent instructions in `AGENTS.md` and `.agents/`. The engineering
skills read their issue-tracker, triage-label, and domain-document conventions
from `docs/agents/`.

```text
small-web-tools/
├── README.md                 English user-facing site manual
├── README.zh-TW.md           Traditional Chinese user-facing site manual
├── CONTRIBUTING.md           English engineering and local-runtime guide
├── CONTRIBUTING.zh-TW.md     Traditional Chinese engineering guide
├── PRIVACY.md                English privacy policy and data-flow disclosure
├── PRIVACY.zh-TW.md          Traditional Chinese privacy policy
├── TODO.md                   Backlog, completed work, and update process
├── ARCHITECTURE.md           Architecture and maintenance reference
├── ARCHITECTURE.zh-TW.md     Traditional Chinese architecture reference
├── AGENTS.md                 Engineering-skill configuration and pointers
├── Dockerfile.dev            Node 22 image for containerized Vite development
├── compose.yaml              Bind-mounted Vite development service and dependency volume
├── .dockerignore             Docker build-context and local-secret exclusions
├── package.json              Scripts, dependencies, and pipeline commands
├── jsconfig.json             TypeScript checkJs configuration for JavaScript
├── eslint.config.js          ESLint flat config for React, hooks, and Cloudflare functions
├── vitest.config.js          Vitest runner configuration
├── vite.config.js            Vite 6 config, dev proxy, and Rollup manualChunks
├── tailwind.config.js        Tailwind tokens mapped to CSS custom properties
├── postcss.config.js         Tailwind and Autoprefixer configuration
├── index.html                Vite HTML shell and React mount point
├── config/
│   ├── network-services.json Network-service policy source of truth
│   ├── ffmpeg-assets.json    Pinned FFmpeg asset sizes and SHA-256 values
│   └── rateLimitPolicies.js  Canonical route, class, binding, limit, and period policies
├── scripts/
│   ├── check-i18n.mjs         Locale-pair structure and interpolation checks
│   ├── check-hardcoded-ui.mjs User-facing string audit
│   └── check-doc-consistency.mjs Documentation/link consistency checks
├── docs/
│   ├── agents/               Issue-tracker, triage-label, and domain-doc rules
│   ├── docker-development.md Docker development workflow
│   └── docker-development.zh-TW.md Traditional Chinese Docker workflow
├── .github/
│   ├── dependabot.yml        Monthly dependency updates, including major versions
│   └── workflows/ci.yml      GitHub Actions CI pipeline workflow
├── public/
│   ├── _headers              Cloudflare Pages security response headers
│   ├── fonts/                Self-hosted WOFF2 UI fonts, licenses, and manifest
│   └── favicon.svg           Static site icon
├── src/
│   ├── main.jsx              React mount and global stylesheet import
│   ├── App.jsx               Application-shell composition and registry renderer
│   ├── categoryDefinitions.jsx Shared category IDs, labels, and icons
│   ├── toolRouteMetadata.js  Canonical routes, aliases, metadata, and layout flags
│   ├── toolRegistry.js       Lazy component loaders joined to canonical route metadata
│   ├── toolModes.js          Audience and Simple workspace profiles, filtering, and URL helpers
│   ├── toolIcons.jsx         Route icon presentation keyed by registry icon keys
│   ├── styles.css            Theme tokens, global rules, responsive and component styling
│   ├── i18n/
│   │   ├── index.js           Locale resolution, i18next setup, persistence, and document language
│   │   └── locales/           Paired en-US and zh-TW namespace JSON resources
│   ├── lib/                  Pure utility helpers (passwordStrength, resourceLimits, thirdPartyServices)
│   ├── hooks/                Routing, persistence, and document-title shell effects
│   ├── tests/                Vitest unit test suites and setup
│   └── components/
│       ├── ui/               Shared Card, Button, FieldInput, ToolHeader, and related primitives
│       ├── HomeGrid.jsx      Full and audience dashboard tool grid
│       ├── SimpleHome.jsx    Search-first essential-tool launcher
│       ├── LanguageSwitcher.jsx Shared responsive locale menu and focus lifecycle
│       ├── AppHeader.jsx     Desktop brand, category navigation, search, locale, and theme controls
│       ├── AppFooter.jsx     Registry-driven footer navigation and project actions
│       ├── DesktopCategoryNav.jsx Pointer shortcut navigation derived from the registry
│       ├── MobileDrawer.jsx  Mobile navigation focus, inert, dismissal, and scroll lifecycle
│       ├── MarkdownPreviewer/ Markdown parsing and validation domain logic
│       ├── *.jsx             Individual tool components
│       ├── useMediaSeparator.js
│       └── mediaSeparatorEngine.js
└── functions/
    ├── _shared/              Shared serverless utilities (safeExternalFetch, requestPolicy)
    └── api/
        ├── *.js              Cloudflare Pages API handlers
        └── tests/            Targeted API handler unit tests
```

`dist/` is generated by `npm run build` and is intentionally ignored.

`functions/_shared/responseHeaders.js` is the executable response baseline for
Pages Functions and the static `_headers` policy. `scripts/check-headers.mjs`
rejects drift and validates `config/csp-exceptions.json`. Custom-domain checks use
`PRODUCTION_HOST` and the paired production-hardening runbook.

## Type-checking boundaries

The JavaScript migration uses three explicit TypeScript checkJs projects.
`jsconfig.json` is the broad non-strict baseline. `jsconfig.domain.json` preserves
the existing narrow domain/shared-helper boundary. `jsconfig.ui.json` is the
incremental shared-UI boundary; it enables `strictNullChecks` for `LanguageSwitcher`,
the desktop header/category/footer components, `MobileDrawer`, the routing/title/
persistence hooks, shared category definitions, the extracted audio/video metadata
domains, and their pure route/mode dependencies. `npm run typecheck` executes all
three projects in CI. New exclusions must remain minimal and documented, and an
expanded UI boundary must fix every newly exposed error in the same change.

## Application architecture

### Entry and shell

`src/main.jsx` mounts `<App />` and imports `src/styles.css`.

`src/App.jsx` composes the application shell and registry renderer:

- `src/toolRouteMetadata.js` is the only route metadata source. Sidebar, desktop navigation, dashboard cards, active titles, footer links, static layouts, lazy components, and route tests derive from it; `src/toolRegistry.js` only joins that metadata to lazy component loaders.
- Registry aliases preserve old bookmarks; `tool-officemeta` resolves to `tool-docmeta`.
- `src/categoryDefinitions.jsx` defines the six presentation groups and shared icons: Text, Developer, Network, Media, Bioinfo, and Utilities.
- `useAppRouting` initializes `activeTool` from `/home[/<audience>]/<tool-slug>` or `/simple/<tool-slug>` and synchronizes navigation and browser history with the path.
- `useAppRouting` initializes `toolMode` from the validated `/home` or `/simple` path. The workspace path
  remains in the URL while path navigation changes tools.
- `useShellPersistence` owns active-tool session state plus theme and sidebar persistence; `useDocumentTitle` owns title updates independently of storage availability.
- `renderActiveTool()` resolves the active registry entry and renders its lazy component. The `privacy` route is registered but excluded from the tool catalog.

The shell supplies a responsive desktop sidebar, mobile drawer, top navigation, breadcrumbs, footer, search, theme control, and a centered tool stage. `AppHeader`, `DesktopCategoryNav`, and `AppFooter` own the desktop header and footer presentation while `App.jsx` passes registry-derived data and navigation callbacks.

`src/components/MobileDrawer.jsx` owns the narrow-screen drawer boundary. The closed
drawer is unmounted; opening moves and traps focus, makes the obscured shell inert,
locks body scrolling, and supports Escape, overlay, explicit-close, and route
dismissal before restoring focus to the opener.

`src/components/LanguageSwitcher.jsx` is rendered by `App.jsx` in the mobile header and by `AppHeader.jsx` in the desktop header. It is the shared owner of locale options, menu state, keyboard navigation, and focus restoration; the desktop control is omitted in the Simple workspace.

### Internationalization runtime

`src/i18n/index.js` initializes `i18next` with the `react-i18next` adapter and
the four paired namespaces under `src/i18n/locales/en-US/` and
`src/i18n/locales/zh-TW/`: `common`, `navigation`, `tools`, and `errors`.
English (`en-US`) is the default and fallback locale; Traditional Chinese
(`zh-TW`) is the second supported locale.

Initial locale resolution is deterministic: a valid persisted value at
`small-web-tools.locale` wins, then the browser's preferred languages, then
English. `src/components/LanguageSwitcher.jsx` calls `changeLocale()`, updates
`document.documentElement.lang`, and persists only the normalized supported
locale. Storage failures do not prevent an in-memory language change.

Route IDs, URL paths, tool IDs, file extensions, protocol names, and other
interoperability-sensitive identifiers remain stable. `toolRegistry.js` keeps
those identifiers separate from localized titles, descriptions, tooltips, and
search metadata; English search terms remain available as fallback aliases.
`sortLocalizedTools()` uses the active locale's `Intl.Collator`, while tools use
locale-aware `Intl` formatting for reader-facing numbers, dates, and times.
User content and content algorithms are not translated based on the UI locale.

Every UI string change must update both locale resource trees. `npm run i18n:check`
checks key parity, duplicate keys, non-empty values, and interpolation parity;
`npm run i18n:audit` scans JSX for unreviewed user-facing literals. Focused
runtime and resource tests are in `src/tests/i18n.test.js`,
`src/tests/i18nValidation.test.js`, `src/tests/i18nHardcodedUi.test.js`, and
`src/tests/wordCounterLocale.test.js`.

### Audience and Simple workspaces

`src/toolModes.js` defines the complete dashboard plus five audience profiles:
daily users, developers, bioinformatics researchers, designers, and students.
The separate `SIMPLE_WORKSPACE` defines eight high-frequency tools. App-level
filtering applies audience profiles consistently to dashboard cards, sidebar,
and search; the Simple sidebar remains limited to its essentials while Simple
search can open any registered tool.

`AudienceSwitcher.jsx` renders the homepage segmented control for the complete
homepage and five audience profiles. `HomeGrid.jsx` places it beside the
introduction while preserving the complete
categorized dashboard and renders flat audience recommendations. `SimpleHome.jsx`
provides an all-tool search and eight compact shortcuts inside the reduced shell.
Routing uses `/home[/<audience>][/<tool-slug>]` and
`/simple[/<tool-slug>]`; legacy `/home/simple` addresses redirect to `/simple`.
Focused coverage lives in `toolModes.test.js`, `homeGrid.test.jsx`,
`audienceSwitcher.test.jsx`, `simpleHome.test.jsx`, and `App.test.jsx`. Mermaid is
part of the developer audience. Every other navigable tool must appear in at least
one curated workspace or have a maintained rationale in
`INTENTIONAL_CURATED_EXCLUSIONS`; `toolModes.test.js` enforces that invariant.

### Shared tool-page contract

Every routed tool page uses the shared visual contract established by Image Metadata:

1. Use `Card` with `variant="tool"` as the page container.
2. Render exactly one `ToolHeader` title for the page identity.
3. Keep page-level descriptions out of `ToolHeader`; helper text belongs inside the feature that needs it.
4. Preserve the shared desktop card spacing (`p-6`, `gap-4`) and allow the mobile `.tool-card` rules in `styles.css` to handle compact screens.

`src/components/ui/AutoDetectConverter.jsx` implements this contract for the
Slashes, ASCII, Unicode, and URL converters. Slashes and ASCII expose the
automatic direction detector only; Unicode and URL retain explicit
encode/decode controls where direction can be ambiguous.

### Styling and theme

`src/styles.css` defines light and dark CSS custom properties such as `--bg-app`, `--bg-card`, `--text-main`, `--accent`, and `--border-color`. `tailwind.config.js` exposes those tokens as Tailwind color, shadow, and font utilities.

Inter, JetBrains Mono, Plus Jakarta Sans, and TASA Orbiter are served from `public/fonts/`; their versions, subsets, and OFL license files are recorded in `public/fonts/MANIFEST.md`. The application makes no automatic Google Fonts request.

Prefer the shared primitives and existing design tokens. Add global CSS only for truly shared behavior or component-specific rules that cannot be expressed clearly with the existing utilities.

## Route inventory

| Route ID | Navigation label | Component | Category |
| --- | --- | --- | --- |
| `tool-home` | Dashboard | `HomeGrid.jsx` | Dashboard |
| `tool-wc` | Word Counter | `WordCounter.jsx` | Text |
| `tool-casing` | Casing Switcher | `CasingSwitcher.jsx` | Text |
| `tool-slash` | Slashes Converter | `SlashesConverter.jsx` | Developer |
| `tool-ascii` | ASCII Converter | `AsciiConverter.jsx` | Developer |
| `tool-unicode` | Unicode Converter | `UnicodeConverter.jsx` | Developer |
| `tool-url` | URL Encoder & Decoder | `UrlEncoderDecoder.jsx` | Developer |
| `tool-markdown` | Markdown Previewer | `MarkdownPreviewer.jsx` | Developer |
| `tool-mermaid` | Mermaid Converter | `MermaidConverter.jsx` | Developer |
| `tool-code-preview` | VS Code Preview | `CodePreviewer.jsx` | Developer |
| `tool-fontextractor` | Font Extractor | `WebsiteFontExtractor.jsx` | Developer |
| `tool-base` | Base Converter | `BaseConverter.jsx` | Developer |
| `tool-folder-analyzer` | Folder Analyzer | `FolderAnalyzer.jsx` | Developer |
| `tool-iplookup` | IP Lookup | `IpLookup.jsx` | Network |
| `tool-speedtest` | Speed Test | `NetworkSpeedTest.jsx` | Network |
| `tool-color` | Color Converter | `ColorConverter.jsx` | Media |
| `tool-imgmeta` | Image Metadata | `ImgMeta.jsx` | Media |
| `tool-docmeta` | Documents Metadata | `DocMeta.jsx` | Media |
| `tool-audiometa` | Audio Metadata | `AudioMeta.jsx` | Media |
| `tool-videometa` | Video Metadata | `VideoMeta.jsx` | Media |
| `tool-mediasplit` | Media Splitter | `MediaSeparator.jsx` | Media |
| `tool-svg-png` | SVG to PNG | `SvgToPngConverter.jsx` | Media |
| `tool-dna` | DNA/RNA Converter | `DnaConverter.jsx` | Bioinfo |
| `tool-codon` | Codon Table | `CodonTable.jsx` | Bioinfo |
| `tool-phred` | Phred Scale Converter | `PhredScaleConverter.jsx` | Bioinfo |
| `tool-barcode` | Barcode Generator | `QrBarcodeGenerator.jsx` (`barcode` tab) | Utilities |
| `tool-currency` | Currency Converter | `CurrencyCounter.jsx` | Utilities |
| `tool-date` | Date & Time Counter | `DateCounter.jsx` | Utilities |
| `tool-roman` | Roman Numeral Converter | `RomanNumeralConverter.jsx` | Utilities |
| `tool-password` | Password Generator | `PasswordGenerator.jsx` (`generate` tab) | Utilities |
| `tool-pwstrength` | Password Strength | `PasswordGenerator.jsx` (`check` tab) | Utilities |
| `tool-qrcode` | QR Code Generator | `QrBarcodeGenerator.jsx` (`qr` tab) | Utilities |
| `tool-qrbarcodescan` | QR & Barcode Scanner | `QrBarcodeScanner.jsx` | Utilities |
| `tool-wheel` | Random Wheel | `RandomWheel.jsx` | Utilities |
| `privacy` | Privacy & Network Services | `PrivacyPolicy.jsx` | Policy (not in tool catalog) |

## Component groups

### Shared UI: `src/components/ui/`

| File | Role |
| --- | --- |
| `Card.jsx` | Shared card container for tool pages and dashboard cards. |
| `ToolHeader.jsx` | The one-title page identity component for routed tools. |
| `Button.jsx` | Shared button variants and sizes. |
| `FieldInput.jsx` | Labeled input and textarea helper. |
| `AutoDetectConverter.jsx` | Shared two-panel automatic converter interface. |
| `ToggleSwitch.jsx`, `Spinner.jsx`, `ResultDisplay.jsx` | Reusable controls and feedback UI. |

`ExternalMapPreview.jsx` is the shared OpenStreetMap consent boundary for IP Lookup and Image Metadata. It renders coordinate text locally, creates an iframe only while `osm` consent is active, and removes the iframe immediately after revocation or reset.

### Markdown Previewer

`MarkdownPreviewer.jsx` provides a browser-local editor, `.md`/`.markdown`
upload, live preview, formatting helpers, and Markdown download. Its domain
module parses common block and inline syntax into safe React-rendered tokens;
raw HTML and external images are not rendered, and unsafe URL schemes are
discarded. Source-line metadata keeps the independently scrollable editor and
preview aligned in both directions without collapsing fenced-code content.
Focused parser and interaction coverage lives in
`markdownDomain.test.js` and `markdownPreviewer.test.jsx`.

### VS Code Preview

`CodePreviewer.jsx` provides one browser-local, VS Code-style editing surface whose
highlighted display and text input occupy the same window. It supports 26 selectable
language modes, including Bash/Shell; local file input; an on-demand appearance
dialog with System, Light, and Dark presets; accent, background, foreground, and
code font controls; line numbers; source-file download; clipboard copy; and lazy
PNG export without executing code or sending it to a server. The language registry,
filename inference, contrast selection, and highlighting helpers live under
`CodePreviewer/lib/`; focused domain and interaction coverage lives in
`codePreviewDomain.test.js` and `codePreviewer.test.jsx`.

### Media Splitter

`MediaSeparator.jsx` is the page component. `useMediaSeparator.js` owns queue state and actions. `mediaSeparatorEngine.js` downloads the pinned FFmpeg 0.12.6 JavaScript and WebAssembly assets only on demand, verifies the byte lengths and SHA-256 values from `config/ffmpeg-assets.json`, then loads them through Blob URLs. The queue item, waveform, and format-select components keep the UI modular.

### File metadata tools

`ImgMeta.jsx`, `DocMeta.jsx`, `AudioMeta.jsx`, and `VideoMeta.jsx` parse user-selected files in the browser. They support tool-specific inspection, comparison, export, or metadata-removal workflows without routing files through this application.

Audio parsing, format detection, metadata stripping, tag labels, and URL ownership
live under `src/components/AudioMeta/lib/`. MP4/MOV parsing, codec/color mappings,
timecode conversion, browser probing, and the serialized FFmpeg audio-extraction
service live under `src/components/VideoMeta/lib/`. The extraction service owns
unique virtual filenames, progress-listener removal, virtual-file deletion,
cancellation checks, and engine termination. `useObjectUrlRegistry` remains the
component-level owner of preview, derived-output, and download Blob URLs. Focused
coverage lives in `audioMetadataDomain.test.js` and `videoMetadataDomain.test.js`.

Pure document formatting/parsing helpers live under `src/components/DocMeta/lib/`.
QR/barcode encoding rules and codon input/filter/presentation rules live in their corresponding
`src/components/<Tool>/lib/` directories. Focused coverage is in
`documentMetadataDomain.test.js`, `qrBarcodeDomain.test.js`, and
`codonDomain.test.js`; DNA/RNA copy formatting coverage is in `dnaCopy.test.js`,
time-difference coverage is in `timeDomain.test.js`, Roman numeral coverage is
in `romanDomain.test.js`, Phred conversion coverage is in `phredDomain.test.js`,
sanitized SVG parsing/export-size coverage is in `svgDomain.test.js`, and URL
percent-encoding coverage is in `urlDomain.test.js`. The converter-mode, folder-picker,
Color Sync, and image-stripping guidance regressions are covered by
`converterClipboard.test.jsx` and `enhancementUi.test.jsx`.

## APIs and development middleware

Cloudflare Pages-compatible handlers live in `functions/api/`:

| Endpoint | File | Purpose |
| --- | --- | --- |
| `GET /api/iplookup?ip=<address>` | `iplookup.js` | Query fallback IP geolocation providers and normalize the response. |
| `POST /api/extract-fonts` | `extract-fonts.js` | Same-site-only, rate-limited scan of bounded public HTML/CSS; returns declaration metadata and truncation information without fetching font files. |
| `GET /api/exchange-rates` | `exchange-rates.js` | Fetch and normalize live USD-based exchange rates after browser consent. |

Targeted `*.test.js` suites live in `functions/api/tests/`. `vitest.config.js`
includes `functions/api/**` in the coverage gate with the same thresholds as
the shared server and client libraries.

`functions/_shared/requestPolicy.js` owns Font Extractor's 4 KiB request cap and aggregate job limits (HTML/CSS/total bytes, stylesheet count, import depth, face count, concurrency, and deadline). `functions/_shared/fontExtractionCapability.js` fails production extraction closed unless short-lived runtime evidence matches the configured Cloudflare compatibility date, fetch implementation revision, and required scenario set. `vite.config.js` mirrors only IP lookup (`/api/iplookup`) for local Vite development. Use a Cloudflare Pages local runtime when testing the other Functions.

Font extraction treats HTML `rel` values as case-insensitive token lists and returns
every remote `url()` candidate in each font-face source list in declared order.
Local and data sources are ignored without hiding later remote fallbacks; candidates
are deduplicated by normalized absolute URL and face metadata.

Production rate limits are enforced by the service-bound Worker in `workers/rate-limiter/`; the root `wrangler.jsonc` binds Pages Functions to it as `RATE_LIMITER_SERVICE`. Run that Worker separately during complete local integration testing. `npm run platform:integration` starts the Pages and Worker configurations with isolated local state, proves concurrent requests hit the configured platform limit, and proves the missing-service path fails closed. The in-process limiter is available only in explicit development mode and production fails closed when the binding is absent.
`config/rateLimitPolicies.js` is the canonical route-policy source consumed by
Pages helpers, the Worker, local integration, and configuration validation.
Wrangler's platform-required numeric declarations are checked against it; unknown,
orphaned, missing, or numerically mismatched bindings fail `platform:check`.
The Pages-side deadline is attached to the service-binding `Request.signal`, so a
timeout bounds the caller and propagates cancellation to the Worker runtime while
still returning the same fail-closed 503 response.

`test/integration/ssrf-worker/` and `test/integration/ssrf-target-worker/` are
isolated Cloudflare-runtime fixtures for the outbound-fetch boundary. Run
`npm run test:ssrf-runtime` only when temporary Cloudflare deployment is intended;
it uses an unclaimed, auto-expiring preview account and prints no token or claim URL.
Successful output includes machine-readable, 30-day gate metadata tied to the
compatibility date and fetch implementation revision; missing, mismatched,
incomplete, or expired metadata leaves production extraction disabled.

### Local completion and deferred Cloudflare operations

The C06–C16 repository and local-runtime remediation scope was accepted as complete
on 2026-07-26. Production deployment, live Cloudflare SSRF evidence, and staged HSTS
observation are owner-deferred operational work. They are not prerequisites for
local development completion. If a Cloudflare development or deployment error is
reported later, use `npm run platform:check`, `npm run platform:integration`, and
the opt-in `npm run test:ssrf-runtime` evidence workflow as applicable; do not infer
permission to deploy from the presence of those commands.

The Wrangler configuration files (`wrangler.jsonc`,
`workers/rate-limiter/wrangler.jsonc`, and the integration fixture configurations)
are version-controlled. Local Wrangler state and credentials are not:

- `.wrangler/`, `.wrangler-*/`, and `.tmp-*/` are disposable runtime/log/state
  directories and are ignored.
- `.dev.vars` and `.dev.vars.*` are ignored because they may contain secrets;
  `.dev.vars.example` remains tracked as the safe template.
- `dist/`, `coverage/`, `.playwright-cli/`, `test-results/`, and
  `playwright-report/` are generated locally and ignored.
- `.scratch/security/` contains local private security issue records and is
  ignored; security-related work must not be published to GitHub Issues.
- `code_reviews/` contains ignored, local review working records. They are dated
  historical snapshots, are not version-controlled, and are not current project
  status or canonical instructions.

### Repository hygiene

Root files and directories remain version-controlled when they are required to
build, test, operate, or maintain the project:

- `src/`, `public/`, `functions/`, `workers/`, `config/`, `scripts/`, `test/`,
  and `e2e/` contain application code, runtime assets, policies, automation, or
  verification fixtures.
- `package.json`, `package-lock.json`, `.nvmrc`, `index.html`, and the ESLint,
  JavaScript, Knip, Playwright, PostCSS, Tailwind, Vite, Vitest, and Wrangler
  configuration files define reproducible local development and verification.
- `.github/` contains CI and dependency-maintenance configuration;
  `.agents/AGENTS.md` contains repository-scoped development instructions, while
  root `AGENTS.md` points engineering skills to the rules in `docs/agents/`.
- `README.md`, `README.zh-TW.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `PRIVACY.md`, `TODO.md`, and
  `LICENSE` are maintained project documentation or legal material.
- `.dev.vars.example` is safe, non-secret local-runtime documentation. Actual
  `.dev.vars*` files remain ignored.

Editor state, dependency installations, generated output, test reports, local
Cloudflare state, private environment files, incoming scratch data, and review
artifacts belong only in the local workspace and are covered by `.gitignore`.

Folder Analyzer uses the browser directory picker and never accepts an arbitrary
local path. After a scan it can reopen a reset picker to add another folder,
including a previously selected path, without clearing the current analysis.

Image Metadata strips JPEG metadata without re-encoding. For PNG, WebP, and
other browser-decodable formats, it removes metadata through a browser-local
privacy-safe re-encode, preserving PNG/WebP output where supported and falling
back to PNG for other decoded formats. Canon CR3 remains inspection-only because
the browser cannot safely reconstruct its RAW image data.

Color Converter exposes Color Sync as a high-contrast pressed toggle.

## Locale-sensitive behavior

The selected UI locale controls labels and reader-facing formatting, but it does
not determine the language of user content. Word Counter inspects each input:
CJK characters use a character-based reading pace (500 characters per minute),
while non-CJK text uses a word-based pace (200 words per minute); mixed content
combines both estimates. `Intl.Segmenter` supplies grapheme and sentence
boundaries when available, and `Intl.NumberFormat` formats the displayed result.

Password analysis continues to use the bundled English `zxcvbn` dictionary for
pattern detection in this beta. The UI deliberately maps the numeric score to
localized labels, generic feedback, and crack-time bands, so interface translation
is independent of the analysis dictionary. A future language-specific dictionary
can improve recognition without changing the UI contract. Technical algorithms
such as encoders, checksums, codon lookup, media parsing, and cryptographic random
selection remain language-neutral; reader-facing numbers, dates, units, and
pluralized messages use platform `Intl` APIs or i18next interpolation.

## Network-service policy

`config/network-services.json` is the machine-readable source of truth for external providers, domains, purposes, triggers, transmitted data, consent modes, fallbacks, and policy links. `src/lib/thirdPartyServices.js`, the consent manager, and the canonical `/home/privacy` route consume this inventory. Legacy hash addresses are accepted only for backward-compatible redirects. `scripts/check-external-hosts.mjs`, included in `npm run verify`, fails when a production source hostname is not declared.

## Dependencies

| Package | Purpose |
| --- | --- |
| `react`, `react-dom` | React rendering. |
| `@vitejs/plugin-react`, `vite` | Development server and production build. |
| `i18next`, `react-i18next` | Synchronous locale resources, React translation hooks, fallback, and language switching. |
| `vitest`, `@vitest/coverage-v8` | Unit/integration runner and coverage gates. |
| `eslint`, React lint plugins | Static-analysis rules and the non-increasing warning budget. |
| `wrangler` | Pinned Cloudflare Pages/Worker configuration validation and local integration runtime. |
| `tailwindcss`, `postcss`, `autoprefixer` | Utility CSS build pipeline. |
| `exifreader` | Image metadata parsing. |
| `jszip` | Office document metadata parsing and archive handling after archive-limit preflight. |
| `html5-qrcode` | Camera and file-based QR/barcode scanning. |
| `qrcode`, `jsbarcode` | QR and barcode generation. |
| `highlight.js` | Browser-local syntax highlighting for the Code Live Preview tool. |
| `html-to-image` | Lazy browser-local PNG export of styled code previews. |
| `@ffmpeg/ffmpeg` | Client-side media separation using integrity-verified remote core assets. |
| `@zxcvbn-ts/core`, language packages | Pattern-aware password strength analysis loaded only on the password route. |
| `ignore` | Standards-compatible `.gitignore` matching in Folder Analyzer. |
| `ipaddr.js` | Canonical IPv4/IPv6 parsing and public-address validation. |

## Local development

The host workflow below and the containerized Vite workflow in
[`docs/docker-development.md`](docs/docker-development.md) are both supported.
The Docker workflow uses `Dockerfile.dev` and `compose.yaml`, and intentionally
has the same `/api/iplookup`-only function mirror as `npm run dev`.

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

Node.js 22 and Node.js 24 are supported. Use the `npm@10.9.2` release pinned by
the `packageManager` field in `package.json`; CI installs and verifies that exact
version. `npm run verify` is the baseline gate: Git-tag version resolution, a
non-increasing ESLint warning budget,
normal and strict checkJs, coverage thresholds, production build, bundle budgets,
static header policy, the external-host inventory, Cloudflare topology, and
documentation consistency. CI additionally runs dependency checks, Playwright
journeys, and `npm audit`.

The coverage gate includes `App.jsx`, shared category definitions, and the extracted
audio/video domains with per-boundary thresholds. Knip runs in dependency-only and
full dead-code modes with explicit application, Functions, Worker, script, test,
integration, and browser-journey entry points.

## Adding or changing a tool

1. Create or update the component under `src/components/`.
2. Add or revise its single registry entry in `src/toolRegistry.js`.
3. Follow the shared `Card` plus one `ToolHeader` layout contract.
4. Reuse existing UI primitives and theme tokens.
5. Add an API handler only when browser-side code is insufficient; mirror it in `vite.config.js` if local development needs the endpoint.
6. Add or update matching `en-US` and `zh-TW` namespace keys, including labels,
   placeholders, errors, announcements, and accessible names; keep route IDs and
   technical identifiers stable.
7. Update the route inventory and any affected sections of this document and its
   Traditional Chinese companion.
8. Build the project and verify the changed route at desktop and mobile widths in
   both supported locales.

## Documentation maintenance

When user behavior changes, update the relevant entries in `README.md` and
`README.zh-TW.md`. When implementation structure changes, update this document
and `ARCHITECTURE.zh-TW.md`. Keep the CONTRIBUTING and PRIVACY pairs
synchronized when engineering or data-flow policy changes. For locale changes,
also update both resource trees and run `i18n:check`, `i18n:audit`, and
`docs:check`. Record the work and follow the validation/commit sequence in
`TODO.md`.
