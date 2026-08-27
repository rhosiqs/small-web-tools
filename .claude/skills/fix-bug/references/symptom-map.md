# Symptom map

Where each class of defect usually originates, and the trap that most often makes
a first-attempt fix wrong. Read only the sections that match the report.

Contents: [Routing](#routing-url-and-navigation) ·
[Translations](#translations-and-user-facing-text) ·
[Shell, theme, mobile](#shell-theme-and-mobile-layout) ·
[Tool logic](#tool-domain-logic-wrong-output) ·
[Files, Blob URLs, memory](#files-blob-urls-and-memory) ·
[Media & FFmpeg](#media-splitter-and-ffmpeg) ·
[Metadata tools](#metadata-extraction-tools) ·
[Pages Functions](#pages-functions-and-apis) ·
[Privacy & network](#privacy-and-network-policy) ·
[Build, bundle, headers](#build-bundle-and-headers) ·
[Accessibility](#accessibility)

---

## Routing, URL, and navigation

*"The link 404s", "the old URL stopped working", "refresh loses the tool",
"the tool opens but the page title is wrong", "it's missing from search".*

| Look at | Why |
| --- | --- |
| `src/toolRouteMetadata.js` | Canonical ids, aliases, category, `subGroupKey`, `staticLayout`, `navigationVisible`. The single source of route truth. |
| `src/toolRegistry.js` | `loaders` map id → dynamic `import()`, wrapped in `React.lazy()`. A missing or misspelled loader key is a blank page. |
| `src/toolModes.js` | `/home` vs `/simple` workspace profiles, filtering, URL building. |
| `src/hooks/useAppRouting.js` | Location → route id, history sync, legacy hash compatibility. |
| `src/App.jsx` | Shell composition and `renderActiveTool()`. Never add route metadata here. |
| `src/hooks/useDocumentTitle.js` | Page title per route. |

Traps: an id present in `ROUTE_DEFINITIONS` but absent from `loaders` (or vice
versa) fails only at runtime for that one route — `src/tests/App.test.jsx` and
`e2e/routes.spec.js` are where a regression test belongs. Never repair a broken
link by renaming an id; add an alias so old URLs keep resolving.

## Translations and user-facing text

*"Shows the raw key", "still English after switching to 中文", "placeholder is
missing", "plural is wrong", "number/date formatted oddly".*

| Look at | Why |
| --- | --- |
| `src/i18n/locales/en-US/*.json`, `src/i18n/locales/zh-TW/*.json` | Namespaces: `common`, `navigation`, `tools`, `errors`, `mermaid`. Both trees must stay structurally identical. |
| `src/i18n/index.js` | Locale normalization, resolution order (stored → browser → `en-US`), persistence, `document.documentElement.lang`. |
| `src/components/LanguageSwitcher.jsx` | Menu and focus lifecycle. |

Traps: a key that exists in only one locale, an empty string, or mismatched
`{{interpolation}}` names all fail `npm run i18n:check`. A literal string in JSX
fails `npm run i18n:audit` unless it is language-neutral and allowlisted in
`scripts/check-hardcoded-ui.mjs` — keep that allowlist narrow. Reader-facing
numbers, dates, and sorting go through `Intl` with the active locale, while
content algorithms must inspect the content, not the UI locale. Never use a
translated label as an identifier.

## Shell, theme, and mobile layout

*"Overflows on my phone", "drawer won't close", "focus jumps", "dark mode is
unreadable", "two titles on the page", "scroll is locked".*

| Look at | Why |
| --- | --- |
| `src/components/MobileDrawer.jsx` | Focus trap, `inert`, dismissal, scroll lock. Most mobile-only bugs live here. |
| `src/components/AppHeader.jsx`, `DesktopCategoryNav.jsx`, `AppFooter.jsx` | Desktop navigation, search, locale and theme controls. |
| `src/components/ui/` | `Card`, `ToolHeader`, `Button`, `FieldInput`, and friends — shared contract for every tool page. |
| `src/styles.css` | Theme tokens and the few genuinely shared/component rules. |
| `tailwind.config.js` | Tokens mapped to CSS custom properties. |

Traps: the tool-page contract is `Card variant="tool"` plus exactly one
`ToolHeader`; duplicated titles and heading-order drift are contract violations,
not cosmetics. Prefer an existing token or utility over a new global rule, and
prefer extending a shared primitive over a one-off style when the pattern repeats.
These files sit in the strict `jsconfig.ui.json` boundary and have their own
coverage floors, so changes here need tests.

## Tool domain logic (wrong output)

*"Converts the wrong value", "NaN", "rounds badly", "wrong for negative input",
"empty input crashes it".*

Start in the pure module, not the JSX:

- `src/lib/` — `passwordStrength`, `currency`, `numberParsing`, `ipValidation`,
  `ipLookupProviders`, `folderAnalyzerUtils`, `codeHighlighting`, `speedTest`,
  `verifiableRandom`, `mediaMetadataFormatters`, `resourceLimits`,
  `thirdPartyServices`, `publicErrors`, `ephemeralId`.
- `src/components/<Tool>/` — tool-owned domain modules (Markdown, Mermaid, Codon,
  Phred, DocMeta, AudioMeta, VideoMeta, CodePreviewer, DateCounter, and others).

Traps: these paths carry the 80%/70% coverage baseline, so a fix without a unit
test can fail `npm run test:coverage` even when the logic is right. Extract the
failing case as a plain input → output test first; it is nearly always faster than
driving the component. Watch for locale-dependent parsing (`numberParsing`) and
for stale-state bugs where a previous input's derived value survives a re-render.

## Files, Blob URLs, and memory

*"Second file shows the first file's result", "download is empty", "tab memory
grows", "big file silently does nothing".*

| Look at | Why |
| --- | --- |
| `src/hooks/useObjectUrlRegistry.js` | Create/track/revoke ownership for previews, derived outputs, downloads. |
| `src/lib/resourceLimits.js` | Central size/count caps (image and doc 100 MB, media 500 MB, QR image 25 MB, folder 1000 files, batch 100, ZIP entry/ratio guards). |
| `e2e/file-limits.spec.js`, `e2e/error-safety.spec.js` | Existing coverage for rejection paths. |

Traps: a URL created outside the registry leaks and often causes the "shows the
previous file" symptom. Revoke on success, failure, **and** cancellation. When a
file is rejected for size or count, the user needs a localized error, not silence
— check the `errors` namespace has both locales.

## Media Splitter and FFmpeg

*"Export hangs", "cancel doesn't stop it", "works once then fails", "waveform
frozen".*

| Look at | Why |
| --- | --- |
| `src/components/useMediaSeparator.js`, `mediaSeparatorEngine.js` | Queue, lifecycle, and processing engine. |
| `src/components/MediaSeparator*.jsx` | UI, format select, queue item, waveform. |
| `config/ffmpeg-assets.json` | Pinned FFmpeg asset sizes and SHA-256 values. |
| `src/tests/mediaSeparatorEngine.test.js` | Where engine regressions belong. |

Traps: every run needs unique virtual filenames, and listeners plus temporary
files must be removed on success, failure, and cancellation — reusing a name or
leaving a listener attached is the usual cause of "works once". Do not change the
pinned asset hashes to make something load; that check is deliberate.

## Metadata extraction tools

*"GPS shown without consent", "field missing for this camera", "wrong duration",
"stale field from the previous document".*

Components `ImgMeta`, `DocMeta`, `AudioMeta`, `VideoMeta` with domain modules under
`src/components/{AudioMeta,VideoMeta,DocMeta}/lib/`; formatters in
`src/lib/mediaMetadataFormatters.js`; consent journey in `e2e/gps-consent.spec.js`.

Traps: metadata parsing must fail soft — an unreadable field is an omitted field,
not a thrown page. Clear every derived field when a new file is loaded (the
`fix(docmeta): clear total editing time metadata` history is exactly this bug).
Anything that reveals location stays behind the existing consent flow.

**Writing a file back is a different problem from reading one.** Office and
OpenDocument readers validate the container before they show anything, so a
rewritten package that is merely "mostly right" is reported to the user as a
damaged file — PowerPoint is the strictest of the three and refuses where Word
often repairs silently. Every one of these invariants has already been violated
in this repo at least once, so check all of them whenever you touch
`src/components/DocMeta/lib/stripDocumentMetadata.js` or any code that rewrites
a document:

- **A removed part takes its references with it.** Deleting `docProps/custom.xml`
  from the zip is not enough; its `<Override>` in `[Content_Types].xml` and its
  `<Relationship>` in `_rels/.rels` must go too, or the package advertises a part
  that is not there.
- **Typed properties are removed, never blanked.** `dcterms:created`,
  `dcterms:modified`, `cp:lastPrinted`, `TotalTime`, `meta:creation-date`, and
  `meta:editing-duration` are dates, integers, and durations. An empty string is
  an invalid value for those types, not an absent one. Free-text properties
  (`dc:title`, `dc:creator`, …) can safely be emptied in place.
- **Carry the XML declaration across yourself.** Chrome's `XMLSerializer` emits a
  canonical `<?xml ...?>` for a Document; jsdom emits none. A unit test will
  therefore report a missing declaration that the shipped app does not actually
  produce — this repo believed that for a while. Preserving the original text is
  right regardless, but do not call it a corruption cause without browser proof.
- **Do not touch the payload.** Slides, sheets, and document bodies must come out
  byte-identical; only the metadata parts change.

A test for this class of bug asserts package invariants (no dangling references,
no empty typed values, declaration present, payload unchanged) on a synthetic but
structurally faithful fixture — `src/tests/documentMetadataStrip.test.js` is the
worked example.

## Pages Functions and APIs

*"429 for no reason", "500 on lookup", "CORS", "works locally, fails deployed".*

| Look at | Why |
| --- | --- |
| `functions/api/iplookup.js`, `exchange-rates.js`, `extract-fonts.js` | The three endpoints. |
| `functions/_shared/requestPolicy.js`, `safeExternalFetch.js` | Input validation and SSRF-safe outbound fetch. |
| `functions/_shared/rateLimit.js`, `config/rateLimitPolicies.js` | Limits, classes, service binding; fails closed when the binding is missing. |
| `functions/_shared/errorResponse.js`, `src/lib/publicErrors.js` | Correlation ids and the fixed public error vocabulary. |
| `functions/_shared/responseHeaders.js` | Executable baseline shared with `public/_headers`. |
| `functions/api/tests/`, `functions/_shared/tests/` | Handler unit tests (Vitest picks up `functions/**/*.test.js`). |

Traps: Workers runtime only — no `fs`, `path`, or other Node-only APIs. Error
bodies must stay in the `PUBLIC_ERRORS` vocabulary so internals do not leak; put
detail in logs behind the correlation id. Vite mirrors only `/api/iplookup`, so
reproducing any other endpoint needs `npx wrangler pages dev` plus the
rate-limiter Worker. Endpoints are same-origin by default; add CORS only with a
reviewed reason.

## Privacy and network policy

*"Why did it call an external host?", "the privacy page doesn't match behavior".*

`config/network-services.json` is the policy source of truth,
`scripts/check-external-hosts.mjs` enforces it, `src/lib/thirdPartyServices.js`
carries the client view, and `PRIVACY.md` / `PRIVACY.zh-TW.md` are the human
disclosure. `e2e/privacy-network.spec.js` guards the boundary.

A bug fix that introduces or changes an outbound host is a policy change: declare
it in all of the above or find a browser-local solution instead. If the defect is
that the site contacts something undeclared, that is a privacy defect — treat it
as security-sensitive and confirm the handling path before publishing details.

## Build, bundle, and headers

*"Blank page after deploy", "CSP blocks a resource", "bundle check fails",
"version shows 0.0.0".*

`vite.config.js` (`manualChunks`), `scripts/check-bundle.mjs`,
`public/_headers` with `scripts/check-headers.mjs` and
`config/csp-exceptions.json`, `scripts/resolve-version.mjs` with
`npm run version:check`.

Traps: `public/_headers` and `functions/_shared/responseHeaders.js` must not
drift; fix both sides. The displayed version comes from the newest version-formatted
Git tag — `0.0.0-private` in `package.json` is a deliberate placeholder, never the
app version. Never edit `dist/`.

## Accessibility

*"Keyboard can't reach it", "screen reader says nothing", "focus invisible",
"Axe violation in CI".*

`e2e/accessibility.spec.js` rejects every unlisted Axe violation, including
moderate ones. `heading-order` has a documented exception through 2026-09-30 only.
Fix the markup (roles, names, focus order, visible focus ring, live-region
announcements) rather than widening the allowlist; a new exception needs a rule
name, rationale, ISO expiry, and remediation reference.
