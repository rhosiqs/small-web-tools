# Small Web Tools

<p align="center">
  <a href="README.md">English</a>
  &nbsp;·&nbsp;
  <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="CONTRIBUTING.md">Contributing</a>
  &nbsp;·&nbsp;
  <a href="ARCHITECTURE.md">Architecture</a>
  &nbsp;·&nbsp;
  <a href="PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <a href="https://github.com/hhter2/small-web-tools/tags"><img src="https://img.shields.io/github/v/tag/hhter2/small-web-tools?sort=semver&amp;label=version" alt="Version: latest Git tag"></a>
  <a href="https://github.com/hhter2/small-web-tools/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/hhter2/small-web-tools/ci.yml?branch=develop&amp;label=CI" alt="CI status"></a>
  <a href="https://github.com/hhter2/small-web-tools/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a" alt="MIT license"></a>
</p>

Small Web Tools is a browser-based collection of everyday utilities for text, developer work, files, media, networking, bioinformatics, and quick calculations. It is a single-page React application: selecting a tool changes the view without a full page load.

## Using the site

1. Start at the dashboard and choose a category or use the search box.
2. Select a tool from the navigation. Each tool has its own URL path, so a page such as `/home/color` can be bookmarked or shared.
3. Enter text, choose a file, or use the relevant controls. Results update in the current page.
4. Use the light/dark toggle when needed. The selected theme, collapsed desktop sidebar, and most recently opened tool are remembered in the browser.

On a phone or narrow screen, the navigation becomes a drawer opened by the menu button.

### Language and localization

Use the **Language** menu in the header to switch between English (`en-US`) and
Traditional Chinese (`zh-TW`). English is the default and fallback. The selected
locale is saved locally under `small-web-tools.locale`; the browser language is
used only when no saved preference exists. Route IDs, URL paths, and technical
identifiers remain stable, while navigation, search metadata, tool controls,
errors, announcements, and accessible labels are localized. Reader-facing
numbers, dates, sorting, and word-count estimates use the active locale; user
content and algorithmic interpretation are not translated.

### Audience and Simple modes

The audience switcher beside the homepage introduction can show the unchanged
full homepage or a curated set for daily users, developers, bioinformatics
researchers, designers, or students. The top header retains the category menus.

Every audience selection redirects to a bookmarkable address:

- `/home`
- `/home/daily`
- `/home/developer`
- `/home/bioinformatics`
- `/home/designer`
- `/home/student`

The workspace path remains in the address while opening tools, so a link such as
`/home/developer/code-preview` restores both the selected workspace and the
requested tool.

The separate **Simple mode** interface is available at `/simple`. It provides a
large search across every tool and compact shortcuts to eight everyday
essentials. Tools opened there remain in the reduced shell at addresses such as
`/simple/color`; use **Exit Simple mode** or the brand icon to return to `/home`.

## Tool guide

### Text

- **Word Counter** — count words, characters, lines, and reading time.
- **Casing Switcher** — change text to upper, lower, sentence, title, or custom-term casing.

### Developer

- **Slashes Converter** — convert Windows and web-style paths.
- **ASCII Converter** and **Unicode Converter** — convert text to and from character codes.
- **URL Encoder & Decoder** — encode or decode complete URLs, components, and non-ASCII text.
- **Markdown Previewer** — edit, upload, preview, and download Markdown locally.
- **Base Converter** — convert values among binary, octal, decimal, hexadecimal, and sexagesimal.
- **VS Code Preview** — edit and highlight code with line numbers, appearance controls, and local source or PNG downloads; code-file uploads are limited to 2 MiB.
- **Website Font Extractor** — inspect bounded font declarations from a public website without downloading font files.
- **Folder Analyzer** — inspect a selected folder's structure and metrics.

### Network

- **IP Lookup** — look up IP address and location information.
- **Speed Test** — measure latency, download, and upload performance.

### Media

- **Color Converter** — work with color codes, palettes, and the HSL spectrum.
- **Image Metadata**, **Documents Metadata**, **Audio Metadata**, and **Video Metadata** — inspect supported local files and their metadata.
- **Media Splitter** — extract a video's audio track and silent video track.
- **SVG to PNG** — preview SVG markup and export a PNG with a transparent or white background.

### Bioinfo

- **DNA/RNA Converter** — transform sequence direction, complements, and display modes.
- **Codon Table** — explore RNA codons, amino acids, and filters.
- **Phred Scale Converter** — convert base-call and mapping-quality scores to error probabilities.

### Utilities

- **Currency Converter** and **Date & Time Counter** — perform common calculations.
- **Roman Numeral Converter** — convert validated values between decimal and Roman notation.
- **QR Code Generator** and **Barcode Generator** — create downloadable codes.
- **QR & Barcode Scanner** — scan with a camera or image file.
- **Password Generator** and **Password Strength** — generate or assess passwords.
- **Random Wheel** — make a cryptographically seeded selection and export a locally verifiable draw record.

## Privacy and network access

File-focused tools process selected files in the browser whenever possible; files are not sent to this project for analysis. Some capabilities necessarily use network access:

- IP Lookup queries a server-side lookup endpoint and external IP providers.
- Website Font Extractor scans bounded public HTML and CSS through a same-origin endpoint and returns declaration metadata only; it does not preview or download discovered font files. Production scanning stays unavailable unless current Cloudflare-runtime egress verification metadata matches the deployed compatibility date and fetch implementation.
- Network Speed Test measures real network traffic.
- Currency Converter requests live rates only after consent; manual rates remain local.
- Image and IP maps contact OpenStreetMap only after map consent; coordinates remain available without the embed.
- Media Splitter downloads the pinned FFmpeg WebAssembly engine from unpkg on the first processing action and verifies its size and SHA-256 before execution. Media stays in the browser.
- Camera scanning requires browser camera permission.

The footer’s **Privacy** route at `/home/privacy` lists every declared network
service, trigger, transmitted data, consent mode, and fallback. Review that policy,
a tool's own labels, and your browser permissions before using sensitive content.

## Run locally

Requires Node.js 22 or Node.js 24 and npm 10.9.2. Node 22 is the repository
default (`.nvmrc`); `package.json` pins the npm version, and CI verifies both
supported Node.js releases with that exact npm release.

```bash
npm install --global npm@10.9.2
npm ci
npm run dev
```

Vite prints the local URL when the server starts. For a production build and local preview:

```bash
npm run build
npm run preview
```

Run the complete local verification and browser journeys with:

```bash
npm run verify
npm run test:e2e
```

`npm run i18n:check` validates the paired locale resources, `npm run i18n:audit`
audits JSX for unreviewed user-facing literals, and `npm run docs:check` checks
documentation consistency. All three checks are included in `npm run verify`.

`npm run dev` mirrors only the IP lookup function (`/api/iplookup`). To exercise all
Cloudflare Pages Functions locally (currency rates and website font extraction),
follow the two-terminal Pages/Worker instructions in `CONTRIBUTING.md`. Run
`npm run platform:integration` for the automated concurrent-limit and fail-closed
service-binding check.

The Cloudflare Pages production build must use Node.js 22 or 24, `npm ci` followed by `npm run build`, and publish `dist/`.

### HSTS rollout

The checked-in response policy is at the initial HSTS stage:
`Strict-Transport-Security: max-age=86400`. It intentionally omits
`includeSubDomains` and `preload`. After an explicitly approved custom-domain
deployment, follow [`docs/operations/production-hardening.md`](docs/operations/production-hardening.md)
and validate the recorded hostname with:

```bash
PRODUCTION_HOST=your-approved-host.example npm run test:e2e:deployed
```

Keep the one-day stage until it has been monitored and rollback/domain ownership
has been reviewed. Later increases to 30 days and one year require separate
operational approval; subdomains and preload require an explicit full-domain audit.

## Documentation

Maintained explanatory guides use an English file plus a Traditional Chinese
companion with the .zh-TW.md suffix. The language links at the top of each
guide keep navigation in one language. TODO.md is intentionally maintained in
English only.

`CONTRIBUTING.md` is the canonical engineering and local-runtime guide. `ARCHITECTURE.md`
is the canonical architecture and route reference.

- [CONTRIBUTING.md](CONTRIBUTING.md) — engineering standards and local-runtime instructions.
- [PRIVACY.md](PRIVACY.md) — privacy policy and network-service disclosure.
- [SECURITY.md](SECURITY.md) — supported revisions and the private vulnerability-reporting path.
- [`TODO.md`](TODO.md) — active backlog, completed work, and the project update process.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture, route inventory, shared UI conventions, and developer guidance.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
Copyright (c) 2026 Rhosiqs
