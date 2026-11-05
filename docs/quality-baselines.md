# Quality baselines

## Coverage scope

`npm run test:coverage` enforces two tiers in `vitest.config.js`.

- Domain code under `src/lib/`, `functions/_shared/`, and `functions/api/` retains the established 80% line/function/statement and 70% branch thresholds.
- The initial UI/application scope explicitly includes `src/toolRegistry.js`, `src/toolModes.js`, `src/components/LanguageSwitcher.jsx`, and the shared `Button`, `Card`, `FieldInput`, `FullscreenPreview`, and `ToolHeader` primitives. Its initial non-regression floor is 20% for lines/functions/statements and 15% for branches.
- The interactive application shell includes `AppHeader`, `AppFooter`, `DesktopCategoryNav`, `MobileDrawer`, and the routing, persistence, and title hooks. These modules have component-specific floors of 50% for lines/functions/statements and 40% for branches so closed-drawer, overlay, keyboard, history, and persistence paths cannot silently leave coverage.

Browser accessibility checks reject every unlisted Axe violation, including moderate findings. A temporary exception must name the rule, concrete rationale, future ISO expiry date, and remediation reference in `e2e/accessibility.spec.js`.

`AUDITED_ROUTES` is derived from `ROUTE_DEFINITIONS`, so every registered route is audited and a new tool is covered the moment it is registered rather than when someone remembers to extend a list. Each route is audited only after its entry animations settle: several tools tween opacity from zero, and sampling mid-animation measures interpolated colours, which produced contrast failures no user could see and made the suite intermittently red.

Text and status colours are expected to clear the 4.5:1 ratio on the surface they actually sit on, not merely on white, and in both themes. Colours applied through inline styles cannot use Tailwind's `dark:` variant, so they are theme tokens in `src/styles.css`; a filled accent surface pairs `--accent-fill` with `--accent-on-fill` so each theme can put readable text on its own fill. Expressing a subdued state with an `opacity-*` utility dilutes the inherited colour and is the most common way that threshold is missed; use the muted token, or a darker shade of the same hue, instead.

### Temporary Axe exceptions

`TEMPORARY_ACCEPTED_VIOLATIONS` in `e2e/accessibility.spec.js` is empty, so every Axe violation on an audited route is a failure. The list is not a place to park a finding: each entry also fails the suite once its `expires` date passes, so an exception must be removed by fixing the rule it covers.

The former `heading-order` exception is gone. Tool sections that sat at level three directly beneath the level-one `ToolHeader` are now level two, category groups on the dashboard are level two with their sub-groups at level three, and the metadata tools keep a level-two file title above their level-three tables. No route in the registry reports a skipped heading level.

The UI floor is intentionally incremental. New modules are added explicitly, and a threshold may only move upward unless a PR documents a temporary exception and follow-up issue.

## ESLint warning policy

The repository-wide warning budget is zero. `npm run lint` checks every JavaScript source and fails on the first non-zero warning total, which also prevents correctness-adjacent `react-hooks/exhaustive-deps` and `no-unused-vars` warnings from increasing.

CI is a single `Verify` job on the `.nvmrc` Node version (Node.js 22, the minimum supported runtime). It runs `npm ci`, the complete `npm run verify` quality baseline, a blocking `npm run audit`, and the Playwright journeys against the build that `verify` produced, uploading the Playwright report only on failure. Superseded runs for the same ref are cancelled through workflow concurrency, and the job has a 20-minute timeout. Dependency (`deps:check`), dead-code (`deadcode:check`), and Cloudflare-integration (`platform:integration`) checks are not part of CI and run locally when a change touches dependencies or the Pages/Worker topology.
