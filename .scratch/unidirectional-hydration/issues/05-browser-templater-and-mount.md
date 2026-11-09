# 05: Browser templater build and `mount` into an empty container

**What to build:** The same `microtags/htm` import resolves to a browser
build when the bundler uses the `browser` export condition; there is no
runtime environment check. In the browser, `html` returns markup that
`mount(container, markup)` turns into DOM. This ticket covers the create
path only (empty container) and the non-structural bindings:

- Signal as a component prop: assigned to the host's prop accessor.
- Signal or function as an attribute on a plain element: bound to that
  attribute; `false`, `null`, or `undefined` removes it.
- `on<event>` with a function, on a plain element or a host: a listener.
- Anything else: static.

`mount` returns a dispose function that stops effects and removes the
listeners it attached, leaving the DOM in place. Mounting twice on one
container throws. When the browser must create a component whose render
link is absent, it throws an error that names the tag name and points to
`client: true` and the build-time keep list. Stripping itself is
unchanged.

Reactive child-position holes (regions) and adoption of existing DOM are
tickets 06 and 07; here a signal or function in child position may render
once.

**Blocked by:** 02, 03

**Touches:** new browser templater module in `src/` (exports `html`, `h`,
`raw`, `mount`), `package.json` (`exports["./htm"]` gains a `browser`
condition; the `build-cjs` / `build-esm` / `build-esm:min` scripts or a
new sibling script), `tsconfig.build.json` if needed for declarations,
`.size-limit.js` (new entry for the browser templater, limits set to
measured results), `example-hydration/vite.config.ts` (dev alias makes
the same server/browser split), `test/index.ts`

**Status:** done

- [x] Bundling for the browser resolves `microtags/htm` to the browser
      module and bundling for Node resolves the server module
- [x] `mount` into an empty container creates the elements the markup
      describes, including a kept component whose host upgrades
- [x] A signal passed as a component prop updates the host when the
      signal changes, with no attribute write required
- [x] A signal bound to a plain element attribute updates it; `false`,
      `null`, and `undefined` remove the attribute
- [x] An `on<event>` function fires on a plain element and on a host
- [x] After dispose, signal changes no longer update the DOM, listeners
      no longer fire, and the nodes are still in the container
- [x] Mounting a second time on the same container throws
- [x] Creating a component with no render link throws an error that
      contains its tag name
- [x] A consumer who imports only `microtags` gets none of this
      (`microtags` size entry unchanged); `npm run size` passes with the
      new entry
- [x] `npm test`, `npm run test:ssr`, `npm run test:hydration`, and
      `npm run test:hydration-dev` pass
