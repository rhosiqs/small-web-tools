---
name: add-tool
description: Add a new routed tool to small-web-tools — registry entry, icon, tool-page contract, serverless boundary, and the documentation and verification each one requires. Use when a task adds, renames, or removes a tool route.
---

# Adding a tool

`src/toolRegistry.js` is the only route metadata source. A tool exists once it
has an entry there; everything else follows from that entry.

## 1. The component

Build it under `src/components/` — a single `<ToolName>.jsx`, or a tool-specific
subdirectory once it grows supporting modules. Start with one routed component
and extract helpers when complexity warrants it. Add focused tests for any
non-trivial domain logic (parsing, conversion, validation), not for markup.

Follow the shared tool-page contract: `Card` with `variant="tool"`, exactly one
`ToolHeader`, and the primitives in `src/components/ui/`. Extend a shared
primitive when the same control pattern will be reused rather than reimplementing
it locally.

## 2. The registry entry

Add exactly one entry to `src/toolRegistry.js`, copying the shape of a
neighbouring entry — the registry defines every `ToolRoute` field and wraps your
dynamic `loader` in `React.lazy()`, so read it rather than working from a list
that can drift.

Two fields carry rules that are not obvious from the surrounding code:

- `id` uses the `tool-<kebab-case>` convention and must be unique across every
  canonical ID *and* alias in `PUBLIC_ROUTE_IDS`. When a tool is renamed, keep
  the previous ID in `aliases` so existing links keep resolving.
- `navigationVisible` decides whether the tool appears in the catalog, in search,
  and needs an icon. A tool that is reachable by URL but deliberately absent from
  the catalog sets it to `false`.

## 3. The icon

For a catalog tool (`navigationVisible: true`), register an icon in
`src/toolIcons.jsx` under the same `iconKey`. Use an SVG or icon component, not
an emoji, and do not put a background behind the small navigation icon — it is
rendered against the navigation surface and a background breaks the row.

## 4. What not to touch

Nothing goes into `src/App.jsx`. `NAVIGATION_ROUTES`, `PUBLIC_ROUTE_IDS`, and
`STATIC_LAYOUT_IDS` are all derived from the registry, and `renderActiveTool()`
resolves the lazy component through `getToolRoute()`. Adding a route import or a
route-selection branch there creates a second source of truth.

## 5. If the browser is not enough

Prefer processing entirely in the browser. When a tool genuinely needs a server
boundary, add a Cloudflare Pages Function under `functions/api/` and put reusable
policy code in `functions/_shared/`. Declare every new server or third-party data
flow in both `config/network-services.json` and `PRIVACY.md` — the documentation
check reads the first and the privacy policy is user-facing.

Vite mirrors only `/api/iplookup`. Use the Cloudflare Pages local runtime for
anything else, as `CONTRIBUTING.md` describes, and add a Vite mirror only if the
endpoint genuinely needs one for development.

## 6. Documentation

Update `ARCHITECTURE.md`: add the route to the Route Inventory and update the
Repository Map and any affected API or runtime section. `ARCHITECTURE.zh-TW.md`
is its maintained companion and needs the same change. Update other user-facing
documentation only when the task calls for it.

## 7. Verify

Run `npm run verify`, then confirm by hand:

- the canonical path and every alias resolve to the tool
- the lazy component actually renders (a broken `loader` path fails only at
  runtime)
- catalog, search, and icon behavior match `navigationVisible`
- the page holds up at desktop and mobile widths
