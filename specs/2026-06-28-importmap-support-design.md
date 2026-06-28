# Import map support + build fix — design

Date: 2026-06-28

## Problem

The TODO asks to (a) make sure `microtags` is accessible at the `esm.sh`
URLs and (b) add a test proving the import-map import style works, plus
README docs for it.

While verifying esm.sh, a more serious bug surfaced: the **built `dist` is
broken**. `build-esm` and `build-cjs` run esbuild on three entry points
*without* `--bundle`, so internal relative imports dangle:

- `dist/index.js` imports `./reactivity.js` and `./builders.js`, which are
  never emitted (only their `.d.ts` exist).
- The same applies to `index.cjs`, `render.*`, `context.*`.
- `node import('./dist/index.js')` fails: `Cannot find module reactivity.js`.
- The published `microtags@0.0.1` tarball has the identical breakage.

This works on `esm.sh` only because esm.sh **re-bundles from source**, which
masks the broken artifact. The current test suite never caught it because
every test bundles from `src/`, never from the built `dist/`. Only the
`*.min.js` files (built with `--bundle`) are self-contained.

## Goals

1. Fix the build so the published artifacts actually resolve.
2. Provide a self-contained, pre-bundled entry (`microtags/min`) for
   CDN / import-map / local usage with no dependency mapping.
3. Add a deterministic, offline browser test proving the import-map style
   works against the bundled artifact.
4. Document import-map usage in the README.

Non-goal: republishing to npm (a patched release is recommended but is the
maintainer's call).

## Design

### 1. Fix `build-esm` and `build-cjs`

Add `--bundle --packages=external` so internal modules are inlined and the
runtime dependency `alien-signals` stays a bare import (consumers / bundlers
resolve it). For the multi-entry ESM build add `--splitting` so shared
internal code is emitted as chunks rather than duplicated. `@standard-schema/spec`
is a type-only import and drops out of the JS.

Add `src/util.ts` to the entry list for both builds so the existing
`./util` export resolves (today it points at a file that is never built).

Acceptance: after `npm run build`,
- `node --input-type=module -e "import('./dist/index.js')"` succeeds and
  exposes `define`, `peek`, `untracked`.
- `node -e "require('./dist/index.cjs')"` succeeds.
- The only bare import remaining in `dist/index.js` is `alien-signals`.

### 2. New `microtags/min` export

`build-esm:min` already emits `dist/index.min.js`, bundled + minified with
`alien-signals` fully inlined (0 bare imports, confirmed). Expose it:

```json
"./min": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.min.js"
}
```

`dist/render.min.js` and `dist/context.min.js` are likewise self-contained
(0 bare imports). They are used by the test but are not required to be added
as public exports.

### 3. Import-map test (`test/importmap/`)

A real browser test, fully offline (no esm.sh dependency), using the
bundled artifacts so no dependency mapping is needed.

- `test/importmap/index.html`: a page with a real
  `<script type="importmap">` mapping bare specifiers to the **bundled**
  files served from the repo root:

  ```json
  {
    "imports": {
      "microtags": "/dist/index.min.js",
      "microtags/render": "/dist/render.min.js",
      "microtags/context": "/dist/context.min.js"
    }
  }
  ```

  A `<script type="module">` imports via bare specifiers
  (`define` from `microtags`, `render`/`renderList` from `microtags/render`,
  `createContext` from `microtags/context`) and exercises real behavior:
  register a component, drive an attribute-backed prop, resolve a
  `data-ref`, run an effect. It records structured results on
  `window.__IMPORTMAP_RESULTS__` (and sets `window.testsFinished`).

  Assertions are structural / behavioral only — e.g. the custom element
  upgrades to its registered constructor, a prop getter returns the typed
  value, a ref element resolves, an effect updates a property. No matching
  of literal HTML text content (per project no-brittle-tests rule).

- `test/importmap/run.ts`: a standalone Playwright runner (uses the
  `playwright` already provided transitively by `tapout`). It starts a
  static file server rooted at the repo, launches chromium, navigates to
  the page, waits for `window.testsFinished`, reads the results, prints TAP,
  and exits non-zero on any failure. The server is always torn down.

### 4. Wiring

- `package.json`: `"test:importmap"` runs the Playwright runner (e.g. via
  esbuild-to-node or tsx-style execution consistent with the existing
  `test:ssr` pattern). It requires a built `dist/`, so it is kept out of
  the default fast `npm test`.
- `.github/workflows/nodejs.yml`: a new step after the build runs
  `npm run test:importmap` under `xvfb-run`.

### 5. README

Add an "Import map" section after Install:

- The `esm.sh` form (matching the nanotags docs) where esm.sh
  auto-resolves dependencies:

  ```html
  <script type="importmap">
  { "imports": { "microtags": "https://esm.sh/microtags" } }
  </script>
  <script type="module">
    import { define } from 'microtags'
  </script>
  ```

- The self-contained `microtags/min` form, useful for raw-file CDNs
  (jsDelivr / unpkg) or local files where dependencies are not
  auto-resolved.
- Note that subpaths (`microtags/context`, `microtags/render`) follow the
  same URL pattern.

## Files touched

- `package.json` — build scripts, `./min` export, `test:importmap` script.
- `src/*` — unchanged (build config only).
- `test/importmap/index.html` — new.
- `test/importmap/run.ts` — new.
- `.github/workflows/nodejs.yml` — new step.
- `README.md` — Import map section.
- `TODO.md` — remove the completed item.
