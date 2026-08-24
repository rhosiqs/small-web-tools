# AGENTS.md — Agent Instructions & Styling Migration Status for small-web-tools

> This file governs how AI agents should behave in this repository.
> It also tracks the styling migration status (Tailwind CSS).
> Read `CONTRIBUTING.md` for canonical engineering rules and `ARCHITECTURE.md` for
> canonical architecture, routes, runtime topology, and project structure.
> Do not modify this file unless explicitly asked.

---

## 1. Orientation (Read Before Any Task)

1. Read `ARCHITECTURE.md` for the full project map — do **not** scan the entire codebase from scratch.
2. Identify which files are relevant to the current task using the Route Inventory and Repository Map in `ARCHITECTURE.md`.
3. Read only those files. Do not open files outside the stated scope unless a dependency forces it.
4. State which files you plan to read and modify **before** making any changes.

---

## 2. Scope Rules

- **Only touch files that are directly relevant to the task.** If a task says "add a new tool", do not refactor unrelated components.
- **Never refactor, rename, or reorganize code that is not part of the current task.**
- **Never install new npm packages** without explicit user approval. Propose the package name and reason first.
- **Never modify `package-lock.json` directly.** It is auto-generated.
- **Never edit `dist/`.** It is a build artifact.
- If you are unsure whether a file is in scope, ask before reading it.

---

## 3. Adding a New Tool (Mandatory Checklist)

Follow this sequence:

1. Create the routed component under `src/components/` and add focused tests for
   any non-trivial domain logic. A tool may use a single
   `src/components/<ToolName>.jsx` file or a tool-specific subdirectory when it
   has supporting modules.
2. Add exactly one definition to `src/toolRegistry.js`, the only route metadata
   source. Supply every `ToolRoute` field:
   - a unique canonical `id` using the `tool-<kebab-case>` convention and any
     backward-compatible `aliases`
   - `title`, `tooltip`, `category`, `description`, `searchMetadata`, and
     `subGroup`
   - an `iconKey`
   - a dynamic `loader` such as
     `() => import('./components/<ToolName>.jsx')`; the registry wraps this
     loader with `React.lazy()`
   - `componentProps`, `staticLayout`, and `navigationVisible`
3. For a catalog tool (`navigationVisible: true`), register an SVG or icon
   component under the matching `iconKey` in `src/toolIcons.jsx`. Do not use an
   emoji or add a background behind the small navigation icon.
4. Do **not** add route imports or route-selection logic to `src/App.jsx`.
   `NAVIGATION_ROUTES`, `PUBLIC_ROUTE_IDS`, and `STATIC_LAYOUT_IDS` are derived
   from the registry, and `renderActiveTool()` resolves the lazy component with
   `getToolRoute()`.
5. Implement the shared tool-page contract: use `Card` with `variant="tool"`,
   render exactly one `ToolHeader`, and reuse Tailwind utilities, theme tokens,
   and primitives from `src/components/ui/`. Add `src/styles.css` rules only for
   shared behavior or component-specific styling that existing utilities cannot
   express clearly.
6. If browser-side code is insufficient, add a Cloudflare Pages Function under
   `functions/api/` and any reusable policy code under `functions/_shared/`.
   Vite currently mirrors only `/api/iplookup`; add local middleware only when
   the new endpoint genuinely needs a Vite development mirror. Declare every
   new server or third-party data flow in `config/network-services.json` and
   `PRIVACY.md`.
7. Update `ARCHITECTURE.md`: add the route to the Route Inventory and update the
   Repository Map and affected API/runtime sections. Update other user-facing
   documentation only when the task permits it.
8. Run `npm run verify`. Confirm the canonical path and every alias resolve,
   the lazy component renders, catalog/search/icon behavior matches
   `navigationVisible`, and the route works at desktop and mobile widths.

---

## 4. Architecture Constraints

| Constraint | Rule |
|---|---|
| Routing | `src/toolRegistry.js` is the only route metadata source. `App.jsx` synchronizes registry IDs and aliases with canonical `/home` and `/simple` URL paths while retaining legacy hash compatibility, and resolves routes through `getToolRoute()`. **Do not add parallel route metadata or introduce React Router or another router library.** |
| Styling | Use Tailwind utility classes, existing design tokens, and the shared primitives in `src/components/ui/`. Add global CSS only for truly shared behavior or component-specific rules that existing utilities cannot express clearly. **Do not introduce CSS-in-JS.** |
| State management | Local `useState`/`useReducer` only. **Do not introduce Redux, Zustand, or any global state library.** |
| API calls | Prefer browser-local processing. Add server or direct third-party data flows only when required, bounded, consented where appropriate, and declared in `config/network-services.json` and `PRIVACY.md`. Use `functions/api/` when a same-origin server boundary is required. |
| Data privacy | All client-side tools must process data entirely in the browser. **No user data should be sent to any server** unless the tool explicitly requires it (e.g., IP lookup, font extractor). |
| Build tool | Vite 6. Follow the runtime topology documented in `ARCHITECTURE.md`. |

---

## 5. Code Style

- **Language**: JSX (`.jsx`) for all React components. No TypeScript.
- **Components**: Functional components with hooks only. No class components.
- **Naming**: PascalCase for component files and function names (e.g., `MyTool.jsx`). camelCase for variables and props.
- **Tool IDs**: kebab-case prefixed with `tool-` (e.g., `tool-mytool`). Canonical IDs and aliases must be unique across `PUBLIC_ROUTE_IDS` derived from `src/toolRegistry.js`.
- **Styling**: Use Tailwind utility classes, theme tokens, and shared primitives in `src/components/ui/`. Extend a shared primitive when the same control pattern will be reused.
- **No inline styles** unless absolutely necessary for dynamic values.
- Keep tool ownership clear. Start with one routed component and extract
  tool-specific helpers or subcomponents when complexity warrants it.
- **Icons**: Register navigation icons in `src/toolIcons.jsx` by the registry
  `iconKey`. Use SVG or an icon component, not emoji, and do not add a
  background behind the small icon.

---

## 6. Serverless Functions (`functions/api/`)

- Pages Functions are same-origin by default. Add explicit CORS handling only
  when an endpoint has a reviewed cross-origin requirement.
- Vite mirrors only `/api/iplookup`; use the Cloudflare Pages local runtime for other Functions and the dedicated rate-limiter Worker as documented in `CONTRIBUTING.md`.
- Validate inputs, bound resource use, handle errors without leaking sensitive
  details, and reuse request-policy/safe-fetch helpers from `functions/_shared/`
  when applicable.
- Functions run on Cloudflare Workers runtime — **do not use Node.js-only APIs** (e.g., `fs`, `path`, `child_process`).

---

## 7. Directories and Files to Ignore

Unless the task explicitly involves them, **do not read or modify**:

- `node_modules/`, `dist/`, `coverage/`, `test-results/`,
  `playwright-report/`, and `.playwright-cli/` — generated dependency, build,
  coverage, or test output
- `.wrangler/`, `.wrangler-*/`, and `.tmp-*/` — disposable local Cloudflare
  state and integration workspaces
- `package-lock.json` — auto-generated lockfile; never edit it directly
- `.gitignore` — read or change it only when the task changes ignore policy
- `public/` — read or change it only when the task involves static assets,
  fonts, or response headers
- `README.md` — maintained manually by the user; **do not update it as part of any task** unless explicitly instructed
- `TODO.md` — maintained by the project owner for backlog priorities and status. AI agents may read it when needed to preserve its format and may append a completed GitHub Issue to `Completed` only after the issue is closed and its implementation, validation, and commit are complete. Use the existing date, checklist, label, and English-only format. Do not change `Active backlog`, existing entries, label definitions, this update process, or any other TODO.md content unless explicitly instructed. Do not read or modify TODO.md for unrelated tasks.

---

## 8. Before Responding

Before producing any code, confirm:

- [ ] Which files will you read? (list them)
- [ ] Which files will you modify or create? (list them)
- [ ] Does this task require a new npm package? If yes, name it and ask for approval first.
- [ ] Does this task require a new serverless function? If yes, is a dev-proxy mirror also needed?
- [ ] Does this task add or change route metadata in `src/toolRegistry.js`? If
      yes, are the Route Inventory and Repository Map in `ARCHITECTURE.md`, the
      matching icon in `src/toolIcons.jsx`, and relevant route tests in sync?

---

## 9. Updating `ARCHITECTURE.md`

`ARCHITECTURE.md` is the single source of truth for the project structure. Update it whenever:

- A new file or directory is created
- A file is deleted or renamed
- A new tool is added (Route Inventory + Repository Map)
- A new dependency is introduced (Dependencies table)
- A serverless function is added or removed

**Do not wait to be asked — updating `ARCHITECTURE.md` is part of every task that changes the file structure.**

---

## Bilingual documentation transition

This project is transitioning to bilingual English and Traditional Chinese
documentation for users and human developers. Before changing a user-facing or
developer-facing explanatory document, check whether a Traditional Chinese
companion with the .zh-TW.md suffix exists. When the documented behavior,
structure, policy, or workflow changes, update both language versions and keep
English links pointing to English documents and Chinese links pointing to
Chinese documents.

AGENTS.md is an AI-facing instruction file and is intentionally English-only;
do not create or maintain a Chinese counterpart. TODO.md is also intentionally
English-only. Work may additionally be tracked by AI agents through GitHub
Issues and Pull Requests, so not every issue, pull request, or completed change
will appear in TODO.md. Before finishing a documentation task, check README,
CONTRIBUTING, ARCHITECTURE, PRIVACY, font manifests, and test-harness guides
for paired updates; exclude this agent guide and TODO.md from the bilingual
document set.

## 10. Styling Migration Status (Tailwind CSS)

This section tracks the Tailwind CSS migration.

### Current state (Phase 6 — complete)

- Tailwind is configured (`tailwind.config.js`), theme values map to the existing
  CSS custom properties in `src/styles.css` (`:root` / `html[data-theme="dark"]`).
  Colors, radii, and shadows are NOT duplicated — Tailwind reads the same variables.
- Shared primitives live in `src/components/ui/`: `Card`, `Button`, `FieldInput`,
  `ToolHeader`, `ToggleSwitch`, `Spinner`, `ResultDisplay`.
  Use these for any new tool or when touching an existing one.
- `src/styles.css` now contains **only** the following:
  - repository-owned `@font-face` declarations for the fonts in `public/fonts/`
  - `@tailwind base/components/utilities` directives
  - `:root` and `html[data-theme="dark"]` CSS custom property definitions
  - Global resets (`*`, `html/body`, `body`)
  - Global element styles (`h1–h6`, `label`, `textarea`, `input`, `select`)
  - Remaining shared patterns still in use by tool components:
    `.btn-secondary`, `.tab-btn`, `.search-input-group`, `.iplookup-results-layout`
  - Tool-specific styles (CodonTable `ct-*`, HomeGrid, ColorConverter, etc.)
  - Scrollbar styles and remaining `@keyframes`

### Migration status by tool

| Tool | Status |
|---|---|
| **App.jsx (shell layout)** | **done** |
| PasswordGenerator | done |
| ColorConverter | done |
| SlashesConverter | done |
| CasingSwitcher | done |
| WordCounter | done |
| DateCounter | done |
| CurrencyCounter | done |
| AsciiConverter | done |
| UnicodeConverter | done |
| BaseConverter | done |
| DnaConverter | done |
| CodonTable | done |
| IpLookup | done |
| ImgMeta | done |
| DocMeta | done |
| AudioMeta | done |
| VideoMeta | done |
| RandomWheel | done |
| TypingSpeedTest | done |
| NetworkSpeedTest | done |
| QrBarcodeGenerator | done |
| QrBarcodeScanner | done |
| WebsiteFontExtractor | done |
| FolderAnalyzer | done |
| MediaSeparator | done |
| MediaSeparatorQueueItem | done |
| MediaSeparatorWaveform | done |
| MediaSeparatorFormatSelect | done |
| HomeGrid | done |
| BioinfoIcon | done |
| DnaRnaIcon | done |

### Rules for new work

- New tools: build with Tailwind + `src/components/ui/` primitives from the start.
  Add `styles.css` rules only when shared behavior or component-specific styling
  cannot be expressed clearly with existing utilities.
- Touching an existing tool for an unrelated bug fix: no obligation to migrate it,
  but if you do touch its styling anyway, prefer migrating that one component fully
  over patching the legacy CSS further.
- If a reusable control pattern is missing, extend the relevant shared primitive
  with a variant or prop so the pattern stays reusable.

### Still open

1. `Button variant="danger"` is a placeholder — needs a real parity pass
   against `.btn-danger-custom` / `.btn-danger-confirm` before use.
   Do not use `variant="danger"` in any tool component until this is resolved.
