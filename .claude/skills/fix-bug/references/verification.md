# Verification playbook

Run checks in widening circles: the single failing test, then the suite around it,
then `npm run verify`. Every command below is defined in `package.json`; do not
invent new scripts for a bug fix.

## Environment

Node 22 or 24, npm pinned to 10.9.2 (`npm install --global npm@10.9.2`, then
`npm ci`). CI rejects a different npm version. Node 22 is the compatibility gate
(types, unit tests, build); Node 24 runs everything including Playwright, audit,
and the Cloudflare integration.

## Inner loop — the failing test

```bash
npx vitest run src/tests/<file>.test.jsx          # one file
npx vitest run src/tests/<file>.test.jsx -t "case" # one case
npx vitest                                         # watch mode while fixing
npx vitest run functions/api/tests/<file>.test.js  # a Pages Function handler
```

Confirm red before the fix and green after. Vitest collects
`src/tests/**/*.test.{js,jsx}` and `functions/**/*.test.js` in jsdom with
`src/tests/setup.js`.

## Middle loop — the gates most likely to catch you

```bash
npm run test:run        # whole unit suite, fast
npm run lint            # zero warnings allowed, repo-wide
npm run lint:changed    # same rule against origin/develop; run `git fetch origin develop` first
npm run typecheck       # baseline + domain + strict UI checkJs projects
npm run i18n:check      # locale pair structure, empties, interpolation drift
npm run i18n:audit      # rejects user-facing literals in JSX
npm run test:coverage   # per-path thresholds; needed if you touched thresholded paths
npm run docs:check      # documentation and link consistency
```

`npm run typecheck:domain` and `npm run typecheck:ui` run the strict projects
individually when you only need one of them.

## Full gate — before pushing

```bash
npm run verify
```

Runs version → i18n → i18n audit → lint → changed-file lint → typecheck →
coverage → build → bundle → headers → external hosts → Cloudflare config → docs.
This is what CI runs, so a local pass is the cheapest way to avoid a red PR.

## Browser journeys

```bash
npm run test:e2e                          # builds first (pretest:e2e), then Playwright
npx playwright test e2e/routes.spec.js    # one spec (build must be current)
npx playwright test e2e/<spec>.js --headed --project=chromium
```

Playwright serves `vite preview` on `http://127.0.0.1:4173`. Set
`PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_EXTERNAL_SERVER` to point at a server you are
already running. Useful specs by area: `routes.spec.js`,
`simple-workspace.spec.js`, `language-switcher.spec.js`, `accessibility.spec.js`,
`file-limits.spec.js`, `error-safety.spec.js`, `privacy-network.spec.js`,
`gps-consent.spec.js`, `currency.spec.js`, `speed-test.spec.js`,
`font-extractor.spec.js`.

## Serverless fixes

Vite mirrors only `/api/iplookup`, so `npm run dev` cannot reproduce the other
endpoints. For the real local topology, copy `.dev.vars.example` to `.dev.vars`,
set `RATE_LIMIT_HMAC_SECRET` to 32+ random characters, then in two terminals:

```bash
npm run build
npx wrangler dev --config workers/rate-limiter/wrangler.jsonc
npx wrangler pages dev            # second terminal -> http://localhost:8788
```

```bash
npm run platform:integration      # deterministic Pages -> binding -> Worker check
npm run platform:check            # Cloudflare configuration consistency
```

Do not run `npm run test:ssrf-runtime` as part of an ordinary bug fix — it creates
a temporary external Cloudflare preview deployment and is reserved for CR-009
evidence.

## Manual re-check for user-visible fixes

The PR template asks for it, and it catches what jsdom cannot:

- both locales (`en-US`, `zh-TW`), including labels, placeholders, errors, and
  notifications;
- desktop and mobile widths;
- light and dark theme when styling changed;
- keyboard-only path and visible focus when interaction changed.

## Reading a failure

| Failure | Usual meaning |
| --- | --- |
| `i18n:check` key drift | a key added to one locale only, or an empty string |
| `i18n:audit` hit | a literal in JSX; translate it rather than allowlisting |
| coverage threshold on a path you touched | the new branch is untested — extend the test, do not lower the floor |
| `lint:changed` fails while `lint` passes | a warning in *your* changed lines, or `origin/develop` was never fetched |
| `docs:check` | a required token, route, or endpoint is missing from a maintained doc or its `.zh-TW` companion |
| `headers:check` | `public/_headers` and `functions/_shared/responseHeaders.js` drifted apart |
| `version:check` | no version-formatted Git tag reachable; fetch tags rather than editing `package.json` |
