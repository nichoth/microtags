<!-- nightralph:start -->
## Agent skills

When starting a major architectural change or new feature, create an
Architecture Decision Record (ADR) or Feature Decision Record (FDR)
under docs/adr/ or docs/fdr/.
Name them sequentially (e.g., ADR-001-description.md) and add a row to
`docs/adr/INDEX.md`. See `docs/adr/INDEX.md` for the current list.
The document should cover context, decision, trade-offs, and consequences.
If an existing decision is being changed, mark the previous ADR as superseded.

### Issue tracker

Issues are tracked as local markdown files under `.scratch/`.
See `docs/agents/issue-tracker.md`.

Prototypes may live under `.scratch/`, but `npm run lint` lints
`.scratch/**/*.ts` too, so keep them lint-clean. To measure a core
change without touching `src/`, copy the repo to a temp dir (symlink
`node_modules`), overlay the changed files, build with the
`build-esm:min` flags and run `npx size-limit` there with its own
`.size-limit.js`. See
`.scratch/hydration-dx-fixes/prototype-12/measure.sh`.

### Triage labels

Default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.
### Builder and serialization

`ComponentBuilder` in `src/builders.ts` records prop metadata (kind
and coercer) and the render function. It does not serialize. The
host-tag builder, the serializers and attribute escaping live in the
server render support module, `src/render-support.ts`
(`microtags/render-support`, ADR-009). Importing it stores its
`renderHost` under `Symbol.for('microtags.render')` on `globalThis`.
The `render` static that `setup` installs packs a record
(`RenderRecord`: tag, metas, ref names, render fn) and delegates to
that symbol, throwing an error naming the subpath when it is unset.
Core must never import `render-support.ts`, or a bundle with every
render link stripped ships it again. The record shape is a contract
between package copies; changing it needs a new symbol key.

Both the `render` and `renderParts` statics come from one core helper
keyed by registry symbol (`microtags.render`, `microtags.renderParts`);
`renderHost` builds its string from `renderParts`, so a serialization
change lands in the parts. Parts `attrs` are unescaped and live on a
null-prototype object. The browser templater bundles render support
(it calls `register`), so a render-support change also moves the
`microtags/htm (browser)` size entry. To test a class whose render link
the transform stripped, run `transform` on a fixture and execute the
output in a child process with `--alias:microtags=src/index.ts` (lint
bans `new Function`).

Core decides the serializer kind (`boolean`, `json` and so on) by
coercer identity, so the support module never compares coercers. When
adding a coercer type to the prop DSL, add its kind in `withProps` and
a matching branch in `_serialize` in `src/render-support.ts`, and
verify the round-trip in `test/ssr.ts`.

`renderHost` skips extra (non-prop) attrs whose names fail `_attrName`
(the HTML attribute name grammar), since they may come from data.
Declared prop names are not checked. The server templater imports the
support module at load; the browser templater calls its `register` in
`_createHost`. `test/index.ts` and `test/ssr.ts` import the server
templater, so a test that needs "nothing registered" must clear the
symbol (browser) or run a fixture in its own process (SSR, see
`test/fixtures/render-unregistered.ts`). Core is within about 20 B of
its size limit, so prefer the shortest equivalent code there.
README's size table is filled by `scripts/inject-size.ts` (run by the
`version` script): each `MARKERS` row is keyed on a `.size-limit.js`
`name` and needs its `<!-- size:x -->` markers in README, or it throws.

The `MicrotagElementClass` type is parameterized by both `Props` and
`RefDefs`. Changing its signature requires updating all call sites in
`setup()` and any type tests in `test/types.ts`.

`test/types.ts` holds compile-time `Expect<Equal<...>>` assertions only;
it runs as part of `npm run typecheck`. To check that a type is a public
export, import it from `'microtags'` there: that resolves to `dist/`
through the package self-reference, so rebuild before typechecking.
Type-only exports from `src/index.ts` add no bytes to the core bundle.

SSR tests (`npm run test:ssr`) run under Node with no DOM. Browser
tests (`npm test`) require `npm run typecheck` to pass first. Both
suites must stay green: `npm run gate` runs them with every other
check, in cost order. Build runs before typecheck there because
`test/types.ts` resolves `microtags` to `dist/`. Playwright is not in
the gate. tapout serves on a fixed port (8123) shared with other
worktrees, so two browser runs at once fail with `EADDRINUSE`; wait
for the port to free and retry rather than killing the other run.
tapzero's `t.throws` returns a Promise, so a sync test asserting a
throw should use `try`/`catch` and `t.ok`.

### HTML templater (`src/htm.ts`)

`html`, `h`, and `raw` are exported from `microtags/htm`. The `html`
tagged template escapes interpolated strings before `htm` sees them,
using the exported `Markup` class, which stringifies cleanly. `html`,
`raw()` and `h()` all return `Markup`, so nested results are never
double-escaped. `Markup` is not a string: callers that need HTML (e.g.
`innerHTML`, `c.html()`) convert with `String(m)`. `RenderFn` may return
`string | Markup`; the static `render` still returns a string.
`builders.ts` imports `Markup` as a type only, so core stays htm-free.

On the server, any function in a hole (signals are callable) is
evaluated once; in child position its output is wrapped in
`<!--[-->`/`<!--]-->` and plain strings it returns are escaped there,
since they never passed through `html`. Non-empty component children
are wrapped in `<!--[c-->`/`<!--]-->` (a distinct opener, so a region
in the component's own render is not taken for them) before `render`
sees them; the browser's `_createHost` wraps them the same way, and
`_close` counts both openers for depth. Function-valued
`on*` props are dropped. Static pages must stay byte-identical, which
`test/ssr.ts` asserts with exact strings.

Attribute names are checked against `_ATTR` (letter, `_` or `:`, then
letters, digits, `-`, `_`, `:`, `.`); invalid ones are skipped silently,
never thrown, since they come from spreads of user data. The regex is
duplicated in `src/htm.ts` and `src/htm.browser.ts` (separate entries)
and must stay identical. Any new path that writes an attribute in
either templater needs the same guard; in the browser, guard before an
effect is created, not inside `_setAttr`.
Both templaters' `h` throw when a tag in `VOID` has any child
(including whitespace text), since `htm` would otherwise nest the rest
of the template inside it. The two `VOID` sets must stay identical.
tapzero's `t.throws` returns a promise: make the test `async` and
`await` it, or the assertion lands after the test ends.
`test/parity.ts` is the server/browser attribute contract: a table of
`(input, expected HTML)` cases run against the server `html` by
`test/ssr.ts` and against the browser `html` by `test/index.ts`, which
also compares the two (server markers removed with `stripMarkers`).
Attribute holes are unwrapped from `_Escaped` (in `_val`) and escaped
once; non-prop host attributes follow the browser's boolean rules.
Add a case there when changing how either templater writes attributes.

When adding the `html` entry to the build, update all three esbuild
scripts (`build-cjs`, `build-esm`, `build-esm:min`) in package.json.
The `.size-limit.js` file needs a second entry for `dist/htm.min.js`.

### Browser templater (`src/htm.browser.ts`)

Selected for `microtags/htm` by the `browser` export condition (listed
first in `exports["./htm"]`). It is built by the same three browser
scripts as `src/htm.ts` and has its own `.size-limit.js` entry. Its
`html` returns a `Markup` holding a node description (or `raw` HTML);
`String(m)` still serializes to static HTML, so kept components'
render functions work in the browser. `mount` creates nodes inside an
`effectScope`; creating a host calls its static `render` and parses the
result with `document.importNode`, which upgrades it synchronously.
`RenderFn` accepts both `Markup` types. The example's Vite config
splits the import with a `resolveId` plugin keyed on `ssr`, and aliases
`microtags` with an exact-match regex so it does not swallow
`microtags/htm`. Browser tests import `../src/htm.browser.js` directly;
the resolution test lives in `test/plugins.ts` and needs `dist/`.

Regions (`_region`) and `mount` share one `_morph`: the range between
two `<!--[-->`/`<!--]-->` comments is morphed toward the new value.
Nested effects (attribute bindings, inner regions) are children of the
region effect and are re-created on each run, so a kept node is
re-bound by `_patch`. DOM inserts run untracked (`_dom`) so a host's
setup effects never become region children. Kept nodes move with
`moveBefore` where available; the factory's empty
`connectedMoveCallback` stops that from re-running setup.
`moveBefore` is called only for kept nodes under a connected parent,
inside a try that falls back to `insertBefore`. Tests shadow it on the
parent instance with `Object.defineProperty`. A repeated `key` among a
region's new items throws naming the key, so `mount` or the signal
write that triggered the morph throws.

`mount` over a non-empty container calls `_adopt` instead of `_morph`:
it walks markup items against existing nodes, skipping whitespace text
and non-marker comments, and creates nothing. A `raw()` value is
adopted one DOM node per parsed node with no skipping inside the span;
skipping before it stops at a node of the span's first node type
(`_items` leaves raw nodes in their parsed fragment, so
`previousSibling === null` marks a span start). A region found this way
is passed its existing markers, so its first run adopts and later runs
morph. The browser parser merges adjacent text, so a raw span's
leading text may already have been consumed by the text item before
it: a parsed text node advances the cursor only over a text node. A
tag mismatch always `console.warn`s, then looks ahead through later
siblings in the range for the expected tag, stepping over regions
(only comments that are exactly `[` or `[c`, never stopping past
`end`); if none, the next item is tried against the same node.
Adoption tests build fixtures as static HTML with `<!--[-->`/`<!--]-->`
markers (`<!--[c-->` for component children) via `innerHTML`, since
browser `String(markup)` emits no markers. Adoption alone cannot
observe a children range that closes too early (the walker steps past
`end`); re-run a region around the host so `_patch` morphs the range.
Adoption must stay passive: `_bindEl`/`_bindHost` take an `adopt`
flag that skips static attribute values, and a bound attribute's first
run calls `_setAttr(..., keep)` so it writes only on a mismatch. Assert
this with a `MutationObserver` (`attributes`, `subtree`) attached
before `mount` and read with `takeRecords()`.

`value`, `checked` and `selected` on `input`, `textarea`, `select` and
`option` go through `_setAttr` as DOM properties, never attributes, and
are written only when the bound value changed since the last write (a
`WeakMap` record per element). `_create` and `_patch` morph children
before `_bindEl` so a `select`'s value finds its options. Tests that
prove "bound value wins" must leave the DOM in a state the new bound
value differs from, or they pass on the old attribute path too.
On adopt, a control's first comparison is against the server value
(`defaultValue`/`defaultChecked`/`defaultSelected`, else the live
property, as for a `select`), so a value typed before hydration stays
when the bound value matches the server. A static control value is
still passed to `_setAttr` on adopt (to seed the record), or a
region's next run would overwrite the visitor's edit; test that case
with an adopted region, not only a top-level `mount`.

### Build entry (`src/build.ts`)

Node-only entry. Uses `require('typescript')` at runtime with a
`declare const require` to avoid needing `@types/node` in the browser
tsconfig. Type annotations use `import type TypeScript from 'typescript'`
and reference the `TypeScript` namespace, while runtime calls use the
`ts` variable.

The build script for this entry is `build-node` in package.json, which
targets `--platform=node` separately from the browser entries. It must
stay in the `build` script's chain.

Tests run via `npm run test:build` using the same esbuild-pipe-to-node
pattern as `test:ssr`.

### Plugin entries (`src/esbuild.ts`, `src/vite.ts`)

Node-only entries exporting plugin factories. Both call `transform`
from `src/build.ts` on matching files. The esbuild plugin uses
`onLoad` to read and transform files; the vite plugin uses the
`transform` hook. Both forward transform warnings to the bundler.

Adding a new plugin entry requires updating `build-node` in
package.json (add the source file to both ESM and CJS esbuild
commands) and adding an `exports` entry in package.json.

Tests run via `npm run test:plugins`. Test fixtures live in
`test/fixtures/`. The vite plugin skips modules whose
`this.environment.config.consumer` is `server` (falling back to the
`options.ssr` hook arg), so server builds keep render links. Vite SSR
builds name output after the entry, ignoring `lib.fileName`.
`npm test` typechecks against `dist/`, so run `npm run build` first in
a fresh worktree. Vite lib builds output `.js` (not `.mjs`) with
`formats: ['es']`.
When `transform` keeps any define-chain render link it appends
`import 'microtags/render-support'` (after cascade, skipped if the
source already imports it), so line numbers never shift. Any config
that aliases `microtags` to source must alias that subpath too (the
example's Vite config does). To check what a bundle contains, use
esbuild's `metafile.inputs` with an `onResolve` plugin mapping the
package to `src/` (see `test/plugins.ts`), not minified names.
Scripts outside the bundlers must load `dist/esbuild.cjs`: plain Node
ESM cannot `require('typescript')` from `dist/esbuild.js`.
The `cascade` option in `transform` iterates to a fixed point --
`cascadeRemove` re-parses the output on each pass and removes
declarations/imports whose identifiers have zero references.
`collectReferences` distinguishes declaration sites from usage sites
by checking `parent` node kind. Side-effect imports (no `importClause`)
and exported declarations are always preserved. When trimming a single
specifier from a named import, the comma handling must account for
both leading and trailing comma positions.
### Example hydration folder (`example-hydration/`)

Components import from `microtags` and `microtags/htm` (not relative
`../src/` paths) so the Vite stripping plugin's `findDefineAliases`
recognises the `define` binding. `example-hydration/vite.config.ts`
(its own config; the root config serves only `example/`) aliases resolve
these to `src/` for development. The SSR entry (`ssr.ts`) runs under
plain esbuild `--bundle`, which resolves `microtags` via package.json
exports without the alias. That command passes `--loader:.css=empty`
so component-level `import './x.css'` side-effect imports are no-ops
under Node; without it esbuild refuses to bundle CSS to stdout.

That config imports the plugin from `../dist/vite.js` (the pre-built
Node entry with `--packages=external`) instead of `./src/vite.js`,
because Vite's config bundler rewrites `require('typescript')` in
`src/build.ts` to a `file://` URL, which `require` cannot load. The
dist must be built (`npm run build:node`) before running Vite with it.
`src/build.ts` gives the "peer dependency" error only when the bare
name `'typescript'` fails to resolve; any other load failure says to
use the built form. `test/build.ts` checks both by spawning esbuild,
node and vite (esbuild cannot be bundled into the test itself).

In dev, `@hono/vite-dev-server` runs the app via its `loadModule`
option: the config `ssrLoadModule`s `server/app.ts`, calls `createApp`
with `devLoader` (source scaffold through `transformIndexHtml`), and
wraps `app.fetch`. Its `exclude` list replaces the plugin defaults, so
it must keep excluding `.ts`/`.css`/`/@` paths plus anything outside
the prefix. `injectClientScript` stays off -- the HTML transform
already inserts the Vite client. `npm run test:hydration-dev` starts
the dev server on port 0 and fetches over HTTP.

Modules are split by the side they run on: `client/` (browser only),
`components/` (both sides), `server/` (Node only). The root typecheck
excludes `server/` (`tsconfig.typecheck.json`); `npm run
typecheck:hydration` checks it with Node types via
`server/tsconfig.json`. The stripping `filter` in
`example-hydration/vite.config.ts` matches only `client/` and `components/`. Tests in
`test/index.ts` and `test/ssr.ts` import from these paths, so moves
must update them too.

`example-hydration/index.html` is the checked-in scaffold. `<div
id="root">` holds the `<!--microtags:main-->` page marker; the
`<!--microtags:state-->` marker sits after it, before the module script.
`server/scaffold.ts` `assemble` throws unless each marker appears
exactly once and replaces via a callback so `$&` stays literal. `server/app.ts` exports `createApp`
with an injectable `loadScaffold` and must stay free of Node imports.
Nothing may write to `index.html` (the old ssr-to-file scripts are
gone). `npm run test:hydration` drives the app via `app.request()`.
Routes live in `server/app.ts`; each renders `Layout(state, page)` from
`pages/`, where `pages/routes.ts` maps a route to its page (the
not-found page for unknown routes). The scaffold has no nav: the layout
renders it inside `<div id="root">`. Unknown paths go through Hono's
`notFound` handler, which also assembles the scaffold. Pages read
only `AppState`, so `createApp` takes no page content; new page inputs
go in `state.ts` and `serialize`. `test/hydration.ts` checks that each
response equals a source render of its own payload. Paths outside the
prefix get `NOT_FOUND_ROUTE`; `/index.html` maps to route `/`. `test/hydration.ts`
imports `pages/` from source, so its esbuild command needs
`--loader:.css=empty`; without it the pipe prints a build error and the
suite silently runs zero tests. `client/index.ts` runs on every route, so it must null-check
any element that only one route renders. `ssr:hydration` pipes into
`node -` so a trailing route arg (`-- /list`) reaches the program.

The `html` templater hands components the original string for declared
props (`_Escaped._raw`), so a prop value is escaped once, by the
component, not by both the templater and the attribute serializer.

Lists in pages are a child-position function returning items with a
`key` attribute (`${() => list().map(x => html`<li key=${x}>...`)}`),
so the browser morph keeps existing hosts. To count server-rendered
hosts in Playwright, load once with `.js` requests aborted.

Ref selectors in components must use `r.one<T>()` (data-ref) rather
than `r.one('button')` (tag query) when the host contains multiple
elements of the same tag.

Production: `npm run build:hydration` runs two builds of the example
config -- `vite build` (client, scaffold as input) and `vite build
--ssr` (inputs `server/listen.ts` and `server/app.ts`) -- into
`example-hydration/build/{client,server}` (gitignored). The config is a
function keyed on `isSsrBuild`. `server/listen.ts` reads the built
scaffold relative to its own built location (`../client/...`), exits
non-zero if missing, and registers `serveStatic` on the app *after*
`createApp`, so page routes win and misses reach the 404 scaffold.
`test/hydration.ts` imports the built `app.js` at runtime; the tests
run as ESM (`--format=esm | node --input-type=module`) because CJS
interop breaks the externalized deps. `test/hydration-listen.ts` spawns
the built listener with `PORT=0` and reads the URL from stdout. ESLint
lints `example-hydration/build/` if it exists; delete it before
`npm run lint`.

`example-hydration/state.ts` is shared by both sides and imports types
from `microtags`. Every response carries the serialized state as a JSON
script (`STATE_ID` in `server/scaffold.ts`) at `STATE_MARKER`, which
sits before the module script in `index.html`. `assemble(scaffold,
body, state)` requires exactly one of each marker. Build the payload
with `stateScript`, which escapes `<`. `test/hydration.ts` imports
`state.ts` and `scaffold.ts` from source alongside the built app.
It also scans every JS asset under `build/client` for
`ISOLATION_MARKERS`: fixed strings that must not ship, each first
proven present in a control file (`build/server/app.js`, or
`dist/build.js` for the transform, which the example's server build
does not contain). Take markers from stripped code only, never from
Badge/Notice markup; when Counter's markup changes, update its marker
in the same commit.

`client/index.ts` reads the state script (`STATE_ID`, defined in
`state.ts` and re-exported by `server/scaffold.ts`; client code must not
import `server/`) and mounts `Layout` into `#root`. Components pass
data up with `ctx.emit` and pages wire `on<event>` props to `State`
functions; a component drives a nested host by assigning a signal to
its prop accessor. The root typecheck sets `customConditions:
["browser"]` so `microtags/htm` types resolve to the browser build
(with `mount`). `test/index.ts` imports example components, so `npm
test`'s esbuild passes `--loader:.css=empty`.
Pages import `microtags/htm`, which in `test/index.ts` resolves to
`dist/htm.browser.js`, a different copy from `src/htm.browser.js`.
Both templaters recognise `Markup` by a registry-symbol brand
(`Symbol.for('microtags.markup')`, set on the prototype so it stays
out of the declared type), not `instanceof`, so either `mount` accepts
either copy's markup. Never reintroduce `instanceof Markup` checks.
Tests may still mount pages with `mount` from `'microtags/htm'`.

`Badge` and `Notice` keep their render (`client: true`) because pages
create them in the browser; `Counter` is stripped and the client entry
asserts that. `Counter` takes one `count` prop, owns no signal, and
emits `increment`/`decrement` with no detail. After a signal is
assigned to a prop accessor, the host's HTML attribute is no longer
updated, so neither tests nor docs may read the attribute as the
current value.

`example-hydration/README.md` lists every hydration npm script and
the three directories; renaming a script or moving a module means
updating it, then running `npm run toc:hydration`. ADR-006 records the
scaffold/route design.

### Preact adapter (`src/preact.ts`, `src/preact-shared.ts`)

`microtags/preact` exports `toPreact(El, { events })` (ADR-010).
`src/preact.ts` is the default (Node/SSR) build: it imports
`./render-support.js` and builds the host vnode from `El.renderParts`,
mapping a `''` attr to `true`. Passthrough props (`class`, `id`,
`aria-*`, `data-*`) go into `renderParts` as extra `attrs`, so they get
the same name filter and reach the render fn's `ctx.attrs`. Types and
`splitProps` (declared / events by DOM name / passthrough, and the
children throw) live in `src/preact-shared.ts`, which must never import
render support since the browser build shares it. `preact` is an
optional peer; only `dist/preact.*` may import it. `npm run
test:preact-ssr` compares parsed host tags, not bytes, and
`preact-render-to-string` already prints a `''` attribute bare, so the
`'' -> true` mapping is not observable there. The `preact` dev
dependency is pinned exactly; bump it deliberately.

`src/preact.browser.ts` is selected by the `browser` condition (listed
first in `exports["./preact"]`). It passes declared props and
passthrough attrs as vnode props, `on<event-name>` per mapped event,
and a per-instance (`useRef`) `dangerouslySetInnerHTML` whose
`__html` getter calls `renderParts` only until the host's ref first
fires. Preact never reads `__html` while hydrating, so it is read
before commit only on a client-only mount, so the host is already
filled when it connects and core's empty-host render (ADR-011) skips it.
Its `build-esm:min` entry relies on `--external:preact` (that flag
applies to every min entry, and covers `preact/hooks`) and its size
entry uses `ignore: ['preact']`. Because the root
typecheck sets the `browser` condition, `'microtags/preact'` in
`test/types.ts` is the browser build; compare it with
`'../dist/preact.js'` (dist and src declarations are distinct types,
so never compare a dist type with a src one). Browser tests live in
`test/preact-browser.ts` (imported by `test/index.ts`); its fixture
must not render markup in setup, so client-only tests prove the
adapter supplies it (refs are collected before setup). htm needs void tags self-closed
(`<input />`) or the render static emits `input[object Object]`.
`npm run test:bundles` (`test/bundles.ts`, needs `dist/`) holds the
`MARKERS` table: fixed strings that must not appear in listed built
files, each first found in a control (else "stale"). Entries are read
with their split chunks (render support's code lives in a chunk, not
`dist/render-support.js`); a new `dist` entry belongs in its lists.

### CLI entry (`src/cli.ts`)

Node-only entry. Built with `build-cli` in package.json as CJS with a
shebang banner and `.cjs` extension (because `"type": "module"` in
package.json). Excluded from `tsconfig.build.json` so declaration emit
skips it. Uses the same `declare const require` pattern as `build.ts`
for the typescript import.

The `bin` field in package.json points at `dist/cli.cjs`. Tests run via
`npm run test:cli` using `spawnSync` to invoke the built CLI as a
subprocess. The CLI must be rebuilt (`npm run build-cli`) before running
tests.
<!-- nightralph:end -->

### Playwright e2e (`test/e2e/`, `playwright.config.ts`)

`npm run test:e2e` runs Playwright (chromium only) against the
production listener: `webServer` runs `build:hydration` then
`serve:hydration` with `PORT=8899`. It is not part of `npm test`.
Browsers are a one-time install: `npx playwright install chromium`.
`test/` is in the root typecheck, so specs must not use Node globals
(the config file sits outside `include` and may). Output dirs
(`test-results`, `playwright-report`) are gitignored.
Outside CI the config reuses any server already on port 8899, which
may be a sibling worktree's older build; if only new tests fail, check
`lsof -i :8899` and re-run. To watch hydration, start a
`MutationObserver` from `addInitScript` at `readystatechange` ->
`interactive` (before the module script runs) and push records in the
callback: delivered records are gone, so `takeRecords()` alone reads
nothing.

### Prop accessors (`src/factory.ts`)

Each declared prop gets an accessor on the element prototype. Setup's
`ctx.props.<name>` is a wrapper that reads a bound external signal when
one is assigned, else the host's own signal. Any function assigned to the
accessor is treated as a signal, so a `p.prop()` holding a function value
cannot be set through the accessor. While bound, attribute changes are
ignored and calling the setup prop signal with a value throws (the
component must emit an event instead); unbound props stay writable. Properties set before upgrade are own properties that shadow
the accessor; the constructor deletes and re-assigns them. Type side:
`MicrotagHost<Props>` in `builders.ts` is the instance type of
`MicrotagElementClass`, and the accessors are typed as the prop value
only (mapped types cannot split read and write types). To bind a
signal with its type checked, use the exported `bindProp(host, name,
source)` (in `factory.ts`) rather than a cast. Its prop key is
`Exclude<keyof H, keyof HTMLElement>`, so its `@ts-expect-error` cases
in `test/types.ts` import it from `'microtags'` and need a rebuilt
`dist/`. Do not confuse it with `ctx.bind` (DOM property binding).
Small core exports minify shorter as `export const f = () => {}` than
as `function f () {}`.

### Empty-host render (`src/factory.ts`, ADR-011)

`tryRunSetup` fills an empty host (whitespace-only `innerHTML`, so a
host holding only region marker comments is not empty) from `this.constructor.renderParts` after the context check and
before `collectRefs`. The statics are read at connect time because
`setup` in the builder adds them after `factory` returns. Props are
passed as a plain object built from the host's accessors; passing the
host itself is 12 B smaller but hands the render fn an element. Tests
for it live in `test/index.ts` (`empty host:`); a test that a host is
not rendered over should also be checked against a mutant that always
renders, since it passes on the pre-ADR-011 factory too.

### Host teardown (`src/factory.ts`)

`disconnectedCallback` only queues a microtask; teardown (running the
cleanups) happens there if the host is still disconnected. A `_live`
flag makes `connectedCallback` return early for a host that came back
before teardown, so same-tick moves keep setup state. Tests that check
cleanup after a removal must `await Promise.resolve()` first. A
throwing cleanup now surfaces as an uncaught error, which fails the
tapout run, so tests for it capture the queued task with the
`catchTeardown` helper in `test/index.ts`. To force the morph's
`insertBefore` fallback in Chromium, set `moveBefore` to `undefined` on
the parent instance.

<!-- redeye:start -->
## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.
<!-- redeye:end -->
