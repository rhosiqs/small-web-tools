---
name: fix-bug
description: Diagnose and fix a defect in the small-web-tools site - a tool page that throws, renders wrong output, breaks on mobile, loses a translation, mis-handles a file, or returns a bad API response. Use this whenever someone reports that something in this repo is broken, wrong, missing, crashing, stuck, or "used to work", including reports phrased as a question ("why does the Base Converter show NaN?"), pasted console errors or stack traces, a GitHub bug issue to action, a failing CI check, or Chinese-language reports such as "壞掉了", "沒反應", "跑不出來", "顯示錯誤", "修一下這個 bug". Use it for repairing existing behavior; adding a brand-new tool follows the checklist in AGENTS.md instead.
---

# Fixing a bug in small-web-tools

This repo is a catalog of ~35 browser-local tools behind one registry-driven shell.
Most bugs are therefore local to one tool, and the fastest path is almost always:
identify the route, reproduce it in a test, fix the smallest thing, then let the
project's own gates prove nothing else moved.

The repo's quality gates are strict (zero lint warnings, three checkJs projects,
coverage floors, bilingual locale parity, documentation consistency). A fix that
"works" but trips a gate costs a whole extra CI cycle, so the workflow below front-
loads the cheap local checks.

## Ground rules that outrank convenience

These come from `.agents/AGENTS.md` and `CONTRIBUTING.md`; a bug fix is not an
exception to them.

- Work on a branch and open the PR into `develop`. Never commit to `main`.
- Change only what the defect requires. A bug fix is the worst possible moment to
  rename, reorganize, or "while I'm here" refactor — it hides the real diff from
  the reviewer and from `git bisect` later.
- No new npm packages, no edits to `package-lock.json`, `dist/`, or `README.md`.
- Any user-facing string you touch needs matching non-empty `en-US` and `zh-TW`
  keys; the locale checks fail otherwise.
- Client-side tools keep user data in the browser. If a fix would add a network
  call, stop and ask — it needs `config/network-services.json` and `PRIVACY.md`
  entries and a deliberate privacy decision.
- Security-relevant defects are never published to GitHub. Follow
  `docs/agents/issue-tracker.md` (local notes under `.scratch/security/`) and
  `SECURITY.md`.

## Step 1 — Pin down the report

You need four things before touching code: **where**, **what was expected**,
**what happened**, and **how to trigger it**. Ask only for what's genuinely
missing, and prefer inferring from the codebase over interrogating the reporter.

- **Where**: the route (`/home?tool=…`, `/simple`, a hash URL, or just the tool's
  display name in either language) and whether it also happens in the other
  workspace/locale/theme.
- **Trigger**: exact input, file type/size, or click sequence.
- **Evidence**: console error, stack trace, screenshot, failing CI job name.
- **Scope**: desktop vs mobile width, `en-US` vs `zh-TW`, first load vs after
  switching tools (stale-state bugs usually only reproduce on the second path).

If the report references a GitHub issue, read it with the conventions in
`docs/agents/issue-tracker.md` before starting.

State the reproduction you are going to work from in one or two lines, so the
reporter can correct you before you spend effort on the wrong path.

## Step 2 — Find the owning files from the registry

Routing metadata is centralized, so you can go from a user-visible name to the
component without scanning the tree:

```bash
grep -rn "<tool words>" src/i18n/locales/en-US/tools.json   # display name -> route id
grep -n "tool-<id>" src/toolRegistry.js src/toolRouteMetadata.js  # route id -> component + flags
```

`ARCHITECTURE.md` has the full Route Inventory table (route id → component →
category) plus the Repository Map; read the relevant rows instead of exploring
the whole codebase. A tool is either a single `src/components/<Tool>.jsx` or that
file plus a `src/components/<Tool>/` directory holding its domain logic — pure
logic bugs usually live in the directory or in `src/lib/`, not in the JSX.

Before editing, say which files you will read and which you will change. That is
required by `.agents/AGENTS.md` §8 and it is also the moment you notice the bug is
actually in a shared primitive rather than in the tool.

## Step 3 — Classify the failure

The class of bug determines where the root cause tends to hide and which gates
will judge the fix. Read `references/symptom-map.md` for the per-class table of
suspect files, likely root causes, and known traps (routing/aliases, i18n, shared
UI/theme/mobile, tool domain logic, file & Blob handling, media/FFmpeg, metadata
extraction, Pages Functions, privacy/network policy, build/headers, accessibility).

Resist fixing at the symptom site when the class points elsewhere: a wrong number
rendered in JSX is usually a domain-function bug, and a missing label is usually a
locale-file bug, not a component bug.

## Step 4 — Reproduce in a test before you fix

Write the failing test first. It proves you found the real cause rather than a
plausible-looking one, and it is what stops the bug from returning — several
existing suites (for example `src/tests/markdownPreviewerIssue42.test.jsx`,
`src/tests/mermaidConverterStaleRender.test.jsx`) exist for exactly this reason.

- **Pure logic** → a Vitest unit test in `src/tests/<area>.test.js`. Cheapest and
  most durable; prefer it whenever the bug can be expressed as input → output.
- **Component behavior** → `src/tests/<area>.test.jsx` (React Testing Library or
  the `createRoot` + `act` pattern used by the existing regression suites).
- **Cross-page journeys, real browser APIs, layout, a11y** → a Playwright spec in
  `e2e/`. Add one only when jsdom genuinely cannot express the failure; e2e is far
  slower and CI runs it on Node 24 only.
- When the fix is tied to a tracked issue, the `<area>Issue<N>.test.jsx` naming
  convention already used in `src/tests/` makes the link obvious to reviewers.

Run just that file first (see `references/verification.md` for the commands) and
confirm it fails for the stated reason. A test that passes before your fix is
testing the wrong thing.

## Step 5 — Make the smallest correct fix

- Fix the cause, not the rendering. Guarding a symptom (`?? ''`, `try/catch`
  around the real problem, a `setTimeout`) leaves the defect live everywhere else
  the function is called.
- Keep it inside the tool that owns it. If the cause is in `src/components/ui/`,
  `src/hooks/`, `src/lib/`, or `functions/_shared/`, check the other call sites
  before changing shared behavior — and mention that blast radius in your report.
- Match the surrounding code: functional components and hooks, Tailwind utilities
  and existing design tokens, no inline styles for static values, no new global
  CSS unless the rule is genuinely shared.
- Preserve public routes and aliases. Removing or renaming an id breaks saved
  links; add an alias instead.
- Keep JSDoc types accurate for anything inside the domain or UI checkJs
  boundaries (`jsconfig.domain.json`, `jsconfig.ui.json`) — those run in strict
  mode and reject silent `any` drift.

## Step 6 — Verify in widening circles

Run the cheap checks first so you fail fast, then the full gate. The commands and
what each one catches are in `references/verification.md`. The short version:

1. the new test file, then the full unit suite (`npm run test:run`)
2. `npm run lint` and `npm run typecheck`
3. locale checks if any string changed (`npm run i18n:check`, `npm run i18n:audit`)
4. `npm run verify` before you push — this is what CI runs
5. the affected Playwright spec when the bug was a browser journey
6. `npx wrangler pages dev` (plus the rate-limiter Worker) when the fix is in
   `functions/`, since Vite only mirrors `/api/iplookup`

Also re-check the fix in both locales and at desktop and mobile widths when the
change is user-visible; the PR template asks you to confirm exactly that.

Coverage floors are enforced per path. If you added code under `src/lib/`,
`functions/`, or another thresholded area, `npm run test:coverage` may fail even
though your test passes — extend the test rather than lowering a threshold.

## Step 7 — Sync the documentation you actually invalidated

Docs work is part of the fix, not a follow-up:

- Behavior, route, API, dependency, or structure changed → `ARCHITECTURE.md`
  **and** `ARCHITECTURE.zh-TW.md`.
- User-visible behavior or data flow changed → `PRIVACY.md` / `PRIVACY.zh-TW.md`
  (and tell the user if `README*.md` looks stale — do not edit README yourself).
- Then run `npm run docs:check`.
- Leave `TODO.md` alone unless the issue is closed and the owner's format for the
  `Completed` section applies.

## Step 8 — Ship it

- Commit with the repo's convention: `fix(<scope>): <imperative summary>`, for
  example `fix(docmeta): clear total editing time metadata`. Separate coherent
  phases (test + fix, then docs) rather than one opaque commit.
- Push to the designated branch with `git push -u origin <branch>`.
- Open the PR into `develop` only when asked, filling in the existing
  `.github/pull_request_template.md` sections — including the translation-impact
  checkboxes, which reviewers do read.

## Report back in this shape

Answer in the reporter's language (this project's owner usually writes Chinese;
the code, identifiers, and commit messages stay English).

```
Symptom      one line, as the user experiences it
Root cause   the actual mechanism, naming file:line
Fix          what changed and why it is the minimal change
Regression   the test that now fails without the fix
Verification the commands you ran and their result
Risk         other call sites or edge cases a reviewer should look at
```

Report honestly: if a gate still fails, or you fixed the reported symptom but
suspect a second defect nearby, say so plainly instead of implying green.

## When to stop and ask

Reproducing takes priority over asking, but stop and check with the user when:

- you cannot reproduce after a genuine attempt — describe what you tried and what
  you need (input file, exact URL, browser);
- the real fix requires a new dependency, a new network call, a new API endpoint,
  or removing a public route/alias;
- the cause is a deliberate design decision or a documented limitation rather
  than a defect;
- the fix would spill into a wide refactor of shared code, or the defect is
  security-relevant (then follow the private path, not GitHub).
