# Contributing to Small Web Tools

<p align="center">
  <a href="CONTRIBUTING.md">English</a>
  &nbsp;·&nbsp;
  <a href="CONTRIBUTING.zh-TW.md">繁體中文</a>
</p>

`CONTRIBUTING.md` is the canonical engineering guide. Use `ARCHITECTURE.md` for the
current architecture, route inventory, API topology, and project map.

## Supported environment

- Node.js 22 and Node.js 24 are supported LTS majors; `.nvmrc` selects Node 22 for the repository default. `package.json` accepts only the supported 22.x and 24.x release lines rather than unbounded future Node majors.
- Use npm 10.9.2, pinned by the `packageManager` field. CI rejects a different
  npm version, so install it before restoring dependencies:

  ```bash
  npm install --global npm@10.9.2
  npm ci
  ```

- The frontend is React 18 and Vite 6.
- Production APIs use Cloudflare Pages Functions plus the dedicated rate-limiter Worker
  in `workers/rate-limiter/`.

## Local development

For a containerized frontend workflow that does not require Node.js on the host,
follow the bilingual [Docker development manual](docs/docker-development.md).
The Docker method has the same API scope as Vite; use the Wrangler workflow
below when every Pages Function is required.

Start the browser application:

```bash
npm run dev
```

The Vite middleware mirrors only `/api/iplookup`. To run every Pages Function with
the real local service-binding topology, first copy `.dev.vars.example` to
`.dev.vars` and replace the example `RATE_LIMIT_HMAC_SECRET` with at least 32 random
characters. Build the frontend, then use two terminals:

```bash
npm run build
npx wrangler dev --config workers/rate-limiter/wrangler.jsonc
```

```bash
npx wrangler pages dev
```

Wrangler discovers the Worker named `small-web-tools-rate-limiter` and connects the
`RATE_LIMITER_SERVICE` binding declared in `wrangler.jsonc`. The Pages runtime is
then available at `http://localhost:8788`. The deterministic automated check starts
both sides in isolated local state, sends concurrent requests through
Pages → Service Binding → Worker, and separately proves the production-style
missing-binding path fails closed:

```bash
npm run platform:integration
```

Useful validation commands:

```bash
npm run build
npm run verify
npm run platform:integration
npm run test:e2e
npm run deps:check
npm run audit
```

The opt-in `npm run test:ssrf-runtime` command creates an unclaimed, temporary
Cloudflare preview account and therefore performs an external deployment. Run it
only when Cloudflare-runtime CR-009 evidence is required and the operator accepts
Cloudflare's current Terms and Privacy Policy. The command redacts bearer and claim
credentials; never paste the global Wrangler configuration or claim URL into logs.
Its successful JSON output contains the short-lived `gateMetadata` value required
by production Font Extractor. Re-run it after the compatibility date or fetch
implementation revision changes and before the metadata expires.

`npm run verify` runs Git-tag version resolution, lint-warning budget, the
baseline, domain, and UI checkJs projects, coverage, build/bundle, headers, network
inventory, Cloudflare configuration, and documentation-consistency gates. CI uses
two independent jobs while preserving the required check names `Verify (22)` and
`Verify (24)`. Node 24 runs the complete verification, dependency check, security
audit, Cloudflare integration, Playwright journeys, and build artifact generation;
the dependency and audit gates run before the more expensive integration/browser
steps. Node 22 remains a minimum-runtime compatibility gate that runs type checking,
the unit-test suite, and a production build. Both jobs have explicit timeouts, and
workflow concurrency cancels superseded runs for the same ref. The workflow uses
`actions/checkout@v7`, `actions/setup-node@v6`, and `actions/upload-artifact@v7`.
This preserves explicit coverage of both supported LTS release lines without
duplicating the most expensive browser and audit work. `npm run typecheck:baseline`
checks the broad JavaScript graph without strict mode, `npm run typecheck:domain`
preserves the existing narrow domain/shared-helper boundary, and
`npm run typecheck:ui` enables `strictNullChecks` for the explicitly listed shared
UI migration boundary, including shared category definitions and the extracted
audio/video metadata domains. Expand that boundary only with fixes in the same change;
keep exclusions minimal and documented in `jsconfig.ui.json`.

## Engineering standards

- Use functional React components and hooks. Route metadata belongs in the shared
  tool registry; preserve canonical public paths and backward-compatible aliases.
- Use Tailwind utilities, the design tokens in `src/styles.css`, and primitives in
  `src/components/ui/`. Keep controls keyboard accessible and visibly focused.
- Client-side tools must keep user content in the browser. Add server or third-party
  data flows only when required, bounded, consented where appropriate, and declared
  in `config/network-services.json` and `PRIVACY.md`.
- Pages Functions must use Web Platform/Cloudflare APIs rather than Node-only APIs.
  Put reusable request validation and safe-fetch logic in `functions/_shared/`.
- Add focused unit tests for pure/domain logic and Playwright coverage for critical
  journeys. Avoid relying only on route smoke tests.
- Keep Blob URL ownership explicit: create and revoke preview, derived-output, and
  download URLs through the shared registry. FFmpeg services must use unique virtual
  filenames and remove listeners and temporary files on success, failure, and cancellation.
- Keep Dependabot major-version updates enabled. Review major updates individually;
  do not replace that review with a repository-wide major-version ignore.

## Internationalization

- `src/i18n/index.js` owns locale normalization and initial resolution (persisted
  preference, then browser languages, then `en-US`), i18next setup,
  `document.documentElement.lang`, and persistence. The header language menu
  exposes the supported `en-US` and `zh-TW` locales.
- Put user-facing text in the bounded `common`, `navigation`, `tools`, or `errors`
  namespace under `src/i18n/locales/<locale>/`; never use translated labels as IDs.
- Keep route IDs, URL paths, and technical identifiers independent from translations;
  localize labels, descriptions, tooltips, search aliases, errors, announcements,
  and accessible names.
- Every UI change must add matching, non-empty `en-US` and `zh-TW` keys. Use
  semantic lower-camel-case keys, `{{value}}` interpolation, and i18next plural suffixes.
- Keep interpolation variables identical. Stable technical terms such as DNA,
  MIME, QR, RGB, protocols, and file extensions may remain unchanged when clearer.
- Use the active locale with `Intl` for reader-facing numbers, dates, times, and
  sorting. Content algorithms must inspect content rather than assume the UI locale.
- Run `npm run i18n:check`; it rejects invalid/duplicate JSON, key drift, empty
  translations, interpolation mismatches, and explicit references to missing keys.
- Run `npm run i18n:audit` to reject user-facing JSX literals. The reviewed allowlist
  in `scripts/check-hardcoded-ui.mjs` is only for language-neutral formats, units,
  formulas, font names, barcode names, and keyboard notation; keep it narrow.

Example: add `feature.resetNotice` to both locale files, render it with
`t('common:feature.resetNotice', { count })`, and test both locales. Verify visible
text, placeholders, notifications, assistive text, and page titles without changing routes.

Pull requests must state the translation impact and confirm bilingual desktop/mobile review.

## Documentation and commits

- Update `ARCHITECTURE.md` for structural, route, API, dependency, or runtime changes.
- Update `README.md` and `README.zh-TW.md`, plus `PRIVACY.md` and
  `PRIVACY.zh-TW.md`, when user-visible behavior or data flow changes.
- Keep the English and Traditional Chinese companion documents synchronized when
  a maintained explanatory document changes. TODO.md is intentionally English-only.
- Run `npm run docs:check` after changing maintained guides; locale changes also
  require both resource trees plus `npm run i18n:check` and `npm run i18n:audit`.
- The project owner controls `TODO.md` backlog priorities and status. AI agents may
  append a completed GitHub Issue to its `Completed` section only after the issue
  is closed and its implementation, validation, and commit are complete. Preserve
  the existing date, checklist, label, and English-only format; do not alter the
  active backlog, existing entries, labels, or update process unless explicitly
  requested.
- Commit coherent phases separately. Do not include generated output, secrets, or
  unrelated working-tree changes.
