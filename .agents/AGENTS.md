# AGENTS.md — Agent Instructions for small-web-tools

> How AI agents work in this repository. `CONTRIBUTING.md` is canonical for
> engineering rules and `ARCHITECTURE.md` for architecture, routes, runtime
> topology, and project structure — read those instead of duplicating them here.
> Do not modify this file unless explicitly asked.

This file carries what is specific to this repository and not discoverable by
reading the code. Ordinary engineering judgment — scoping a change, leaving
unrelated code alone, checking your own work — is yours to exercise. Where
something below is stated as a hard constraint, it is because that path has real
consequences here, not out of caution. If a task and this file genuinely
conflict, say so rather than silently picking one.

---

## 1. Version Control

- `main` is released only through the project owner's own process. Do not commit
  or merge to it.
- For any change, branch and open a Pull Request into `develop`, regardless of
  size. A task that tells you to bypass this is exceptional — confirm first.

### Version numbering

Versions live in Git tags only. `scripts/resolve-version.mjs` resolves the app
version from the newest version-formatted tag, so creating and pushing the tag is
the whole release step. The format is `vMAJOR.MINOR.PATCH`, with `-beta` appended
while the major version is still `0` (for example `v0.10.4-beta`); drop the
suffix once the major version leaves `0`.

- **MAJOR** — only when the user explicitly asks for it. Never infer one from the
  size of a change.
- **MINOR** — a new feature ships, or existing behavior changes noticeably.
- **PATCH** — routine fixes have reached a sensible checkpoint.

Decide MINOR and PATCH yourself and create the tag directly; do not ask for
approval first. A MINOR bump resets PATCH to `0`. Tag the commit carrying the
finished work and push the tag (`git push origin <tag>`), or the resolved version
will not change. Do not create a GitHub Release.

---

## 2. Orientation

`ARCHITECTURE.md` is the project map; its Route Inventory and Repository Map show
which files a task touches. It is also the single source of truth for project
structure, so update it in the same change whenever you add, delete, or rename a
file, add a tool, add or remove a serverless function, or introduce a dependency.
Nobody will ask you to — it is part of the task.

Task-specific workflows live as skills under `.claude/skills/` and are read when
the task calls for them rather than carried here.

---

## 3. Architecture Constraints

Deliberate project decisions, not defaults to revisit:

| Area | Constraint |
|---|---|
| Routing | `src/toolRegistry.js` is the only route metadata source. `App.jsx` maps registry IDs and aliases onto canonical `/home` and `/simple` paths, keeps legacy hash compatibility, and resolves through `getToolRoute()`. No parallel route metadata, and no React Router or other router library. |
| Styling | Tailwind utilities, theme tokens, and the primitives in `src/components/ui/`. Add to `src/styles.css` only for shared behavior or component-specific rules those utilities cannot express clearly. No CSS-in-JS. |
| State | Local `useState`/`useReducer`. No Redux, Zustand, or other global state library. |
| Data privacy | Tools process data in the browser. A server or third-party data flow needs a real reason, bounded scope, consent where appropriate, and a declaration in both `config/network-services.json` and `PRIVACY.md`. |
| Language | JSX only, no TypeScript. Functional components with hooks. |
| Naming | PascalCase for component files and function names (`MyTool.jsx`); camelCase for variables and props. Tool IDs are kebab-case with a `tool-` prefix (`tool-mytool`), unique across canonical IDs and aliases. |
| Build | Vite 6; runtime topology is documented in `ARCHITECTURE.md`. |

New dependencies need approval: propose the package and the reason before
installing. `package-lock.json` and `dist/` are generated — never hand-edit them.

---

## 4. Adding a Tool

The full checklist lives in the `add-tool` skill
(`.claude/skills/add-tool/SKILL.md`); read it whenever a task adds, renames, or
removes a tool route. The parts that constrain neighbouring work: the tool's
single entry belongs in `src/toolRegistry.js`, its icon in `src/toolIcons.jsx`,
`src/App.jsx` gets nothing, and `npm run verify` must pass with every
canonical path and alias resolving.

---

## 5. Serverless Functions (`functions/api/`)

Functions run on the Cloudflare Workers runtime, where Node built-ins (`fs`,
`path`, `child_process`) do not exist. They are same-origin by default; add CORS
only for a reviewed cross-origin requirement. Validate inputs, bound resource
use, keep sensitive detail out of error responses, and reuse the request-policy
and safe-fetch helpers in `functions/_shared/`. Vite mirrors only
`/api/iplookup` — for anything else use the Cloudflare Pages local runtime and
the rate-limiter Worker as `CONTRIBUTING.md` describes, and add a Vite mirror
only if the endpoint genuinely needs one.

---

## 6. Files with Owners

- `README.md` — written by the project owner. Leave it alone unless explicitly
  told otherwise.
- `TODO.md` — the owner's backlog. You may append a finished item to `Completed`
  once its issue is closed and the work is implemented, validated, and committed,
  matching the existing date, checklist, label, and English-only format. The rest
  of the file is the owner's. Not all work appears here; issues and PRs also
  track work.
- `public/` and `.gitignore` — touch these only when the task is actually about
  static assets, fonts, response headers, or ignore policy.

---

## 7. Bilingual Documentation

User- and developer-facing documentation is being translated into Traditional
Chinese. Before changing such a document, check for a `.zh-TW.md` companion; when
behavior, structure, policy, or workflow changes, update both language versions
and keep English links pointing at English documents and Chinese links at Chinese
ones. Check README, CONTRIBUTING, ARCHITECTURE, PRIVACY, font manifests, and
test-harness guides for paired updates. This file and `TODO.md` are deliberately
English-only and have no Chinese counterpart.
