# Hono, Vite, and an authored HTML hydration example

Date: 2026-09-25. Repository reviewed at `1e3dbb5`.
Status: research and proposed implementation plan.

Use a checked-in `example-hydration/index.html` for the document scaffold,
Hono JSX for the dynamic fragments, and a Hono route to assemble them.
Let Vite process the HTML's asset references. Hono serves the assembled
document in development and production, using the source template in
development and the built template in production. GitHub Pages is not
a requirement. Writing a rendered HTML file is an optional export.

This recommendation interprets "regular HTML file" literally: the
doctype, head, headings, sections, and script reference belong in `.html`.
A full Hono JSX document is another supported approach, described below,
but it would make `.tsx` the source of the scaffold.

The architectural proposal is recorded in [ADR-006][adr]. No application
code or dependencies were changed for this report.

## What the repository does today

The current flow is:

```text
page.ts + component render methods
    -> ssr.ts, bundled by esbuild and executed in Node
    -> generated example-hydration/index.html
    -> Vite serves or builds the HTML and browser entry
    -> browser registers custom elements and attaches behavior
```

Findings from the local source:

- [page.ts][page] owns the entire document in a template literal. Only
  the counter and list need computed HTML; most of the document is static.
- [ssr.ts][ssr] writes `render()` to stdout. The npm scripts redirect it
  into `index.html`, which [.gitignore][ignore] excludes. That file is
  currently an output, so editing it would not solve the source problem.
- [index.ts][client] imports the custom elements and checks that counter
  and badge render methods were stripped. Notice deliberately retains
  its render method for browser-created content.
- [vite.config.ts][config] currently builds both examples into `public/`.
  The proposed Hono server needs a separate server build alongside the
  client HTML and assets; the current deployment setup is not a constraint.
- [src/vite.ts][plugin] applies stripping to matching modules without
  examining the server/client environment. Loading the Hono app through
  Vite would also strip the server's counter and badge render methods.
- Component modules import CSS. The current Node command ignores CSS
  with `--loader:.css=empty` and defines `import.meta.env` explicitly.
  Vite's development aliases resolve `microtags` imports to source;
  plain esbuild resolves the package exports to `dist/`.
- [package.json][package] declares Vite `^8.0.5`; the installed version
  inspected here is `8.3.0`. TypeScript is `6.0.3`. Hono is not installed.
- There is an existing script mismatch: `start`, `start:hydration`, and
  `build-example` call `build-html:hydration`, but the defined script is
  `build:hydration`. The example scripts also need an explicit prerequisite
  for building the ignored `dist/` entries they import.

The migration should repair those script prerequisites as part of making
the new workflow reproducible from a clean checkout.

## What Hono renders, and where JavaScript comes from

The supplied [Client Components guide][hono-dom] describes
`hono/jsx/dom`: a browser renderer with hooks and a `render()` entry.
Using that runtime for the document would introduce another client
renderer. It is unnecessary for this example.

For the server, use [Hono JSX][hono-jsx], with `.tsx` files and
`jsx: "react-jsx"`, `jsxImportSource: "hono/jsx"`. The `react-jsx`
compiler setting selects the automatic JSX transform; the import source
selects Hono's implementation. It does not require React.

Ordinary Hono JSX rendering produces HTML without automatically sending
the component implementation or a hydration runtime to the browser.
"Zero JS" describes that default rendering behavior, not every possible
Hono response. Explicit script tags add JavaScript, and Hono's optional
streaming Suspense and ErrorBoundary machinery can emit scripts too.
Those features are unnecessary here. [Hono JSX][hono-jsx]

The intended browser payload remains Microtags and this example's client
code. Hono, the HTML reader, and the server JSX runtime must stay outside
the client import graph. Development additionally includes Vite's reload
client. Production should have no Hono runtime overhead in browser JS.

### How Hono applications build their document scaffold

Hono's [JSX renderer middleware][hono-renderer] lets an application put
`<html>`, `<head>`, and `<body>` in a reusable layout. Routes supply
children through `c.render()`. The middleware adds a doctype by default
and supports nested layouts. This is the direct Hono answer to document
scaffolding: a server-rendered layout component.

The current [Hono Workers + Vite guide][hono-workers] demonstrates
`renderer.tsx` using `jsxRenderer`, with `ViteClient` and `Link` from
`vite-ssr-components/hono`. That is a concrete maintained example of
document scaffolding; its Workers runtime is not required for this plan.

[vite-ssr-components][ssr-components] supplies `Script`, `Link`, and
`ViteClient` components plus Vite plugins. It discovers asset entries,
resolves production asset names through a manifest, and supplies reload
support. `ViteClient` renders nothing in production. This is useful when
JSX owns the whole document; it adds little to the recommended HTML-entry
approach, where Vite already processes the script and stylesheet tags.

Hono does not automatically write responses to disk. Its
[SSG helper][hono-ssg] visits registered routes and writes static files;
[@hono/vite-ssg][hono-vite-ssg] integrates that operation with Vite.
These are optional tools if generating files becomes useful. A single
page can also be saved from an `app.request()` response. Neither operation
is needed to serve the page through Hono.

## How React SSR applications use Vite

There are two established document ownership patterns. The official
sources demonstrate both; they do not establish which has the largest
market share. "Typical" here means documented, maintained patterns.

### An HTML template with a server-rendered outlet

The [Vite SSR guide][vite-ssr] describes an authored HTML template,
separate browser and server entries, and a server that assembles the
response. In development, the server reads the template, calls
`transformIndexHtml()`, loads the rendering module with `ssrLoadModule()`,
and inserts rendered HTML. Vite handles modules and development tooling;
the application server owns the HTTP response.

For production, the guide builds client assets and a server entry
separately. The server reads the **built HTML template**, whose asset
references have already been rewritten, and imports the built renderer.
It does not run the Vite development server in production.

The [React SSR template linked by Vite][react-template] makes this
concrete: `index.html` is separate from `server.js`; the server replaces
head/body outlets; `entry-server.jsx` calls React's `renderToString`;
`entry-client.jsx` calls `hydrateRoot`. The template uses Express, but
the document and asset responsibilities transfer to Hono.

React's [hydrateRoot contract][react-hydrate] requires the initial client
tree to match the server output. Microtags takes a different route:
existing custom elements upgrade and bind behavior to their server HTML.
We can borrow the HTML scaffold and build arrangement without adopting
React's renderer, virtual DOM, or root hydration.

### A JSX component owns the entire document

React's [streaming server API][react-stream] accepts a tree representing
the whole document. The renderer emits HTML, and configured bootstrap
scripts load client code. An application can hydrate the entire document;
it can also omit the React bootstrap scripts when no React client runtime
is wanted. Server rendering alone does not require React hydration.

[React Router framework mode][react-root] makes `app/root.tsx` the document
owner. The root renders the HTML scaffold, route outlet, and document
helpers such as `Scripts`, with `Links`/`Meta` when using their route
exports. Its [Vite adoption guide][react-adoption] explicitly replaces
the static HTML entry with that root module. The framework coordinates
the server and browser builds.

React Router's [Scripts documentation][react-scripts] also describes
omitting its script component for traditional HTML behavior. Thus Hono's
server-only JSX is a useful default, but zero hydration runtime is not
an exclusive capability of Hono.

### Asset handling when there is no HTML build entry

If the server owns the whole document, Vite cannot discover arbitrary
asset references inside strings returned at request time. Its
[backend integration guide][vite-backend] describes using a browser entry
and a build manifest. The backend emits the entry's hashed script URL,
its CSS, CSS from static imports, and optional module preloads. The
deployment base must be included in these URLs.

The client build manifest, `.vite/manifest.json`, maps entries to emitted
assets. Vite's SSR manifest instead supports mapping rendered modules to
preload assets. These are different purposes; this example's fixed
HTML-entry build does not require either manifest to reconstruct its
script and CSS tags. [Vite SSR guide][vite-ssr]

For React development, HTML transforms also install the React refresh
preamble. A backend bypassing those transforms must arrange it itself.
This requirement does not apply to our Hono JSX/Microtags combination.
[Vite backend integration][vite-backend]

## Options for this example

| Approach | Authored scaffold | Assessment |
| --- | --- | --- |
| HTML file + Hono JSX fragments | `.html` | Recommended for this request. |
| Hono JSX layout + asset helpers | `.tsx` | Good if JSX owns the document. |
| HTML file + current string renderer | `.html` | Smaller, but omits Hono. |

The first option preserves normal HTML editing and Vite's HTML asset
pipeline. Its cost is a small, explicit contract for replacing outlets.
The second gives shared layouts and dynamic head content a natural home,
but requires asset integration and does not provide an authored HTML
document. Merely renaming the large `page.ts` string to `page.tsx` would
solve only the template-literal complaint.

## Proposed design

### Source ownership

- `example-hydration/index.html`: checked-in document, including static
  sections, title, stylesheet link, module entry, and no-JS visibility.
- `example-hydration/fragments.tsx`: counter and list composition using
  Hono JSX and existing Microtags static render methods.
- `example-hydration/server.ts`: Hono routes and document assembly.
  Keep template loading/asset transformation injectable so development,
  production, and tests use the same route logic.
- `example-hydration/serve.ts`: production Node entry that starts Hono
  and serves the built assets.
- `example-hydration/ssr.ts`: optional stdout/export command using Hono.
- `example-hydration/index.ts`: existing browser behavior and assertions.

The HTML can keep both section wrappers and contain named comments at
the exact insertion points:

```html
<section class="counter-section">
    <h2>Counter with nested badge</h2>
    <!--microtags:counter-->
</section>

<section class="list-section">
    <h2>List from array</h2>
    <ul><!--microtags:list--></ul>
</section>
```

Render and serialize the two fragments, then replace each marker once.
Reject missing or duplicate markers. Use replacement callbacks so `$&`
and similar sequences in rendered text remain literal. Keep these slots
in element-content positions; they are not a general template language.

Only `index.html` owns the doctype and document tags. With this design,
return the assembled string through `c.html()`; a second document layout
or default doctype injection from `jsxRenderer` is unnecessary.

### Bridge Microtags render output into Hono JSX

The static render method in [builders.ts][builders] returns the complete
custom-element host, serialized attributes, and inner HTML. Hono will
not automatically recognize a Microtags class as its own JSX component,
nor expand a literal `<hydra-counter>` into server-rendered children.

Use a small explicit bridge at the fragment boundary. This illustrative
expression belongs in server JSX, with `raw` imported from `hono/html`:

```tsx
<li>{raw(Badge.render({ label: 'AAA' }))}</li>
```

Do not wrap the result in another badge host. Do not use
`microtags/htm`'s `raw` wrapper here: the two libraries have different
trusted-value representations. Hono's [HTML helper][hono-html] marks
output as already escaped; it does not sanitize it.

This matters in the existing example: `badge.ts` and `notice.ts`
interpolate text into ordinary template strings. Their current callers
use fixed values, but those renderers do not escape arbitrary text.
Escape at those leaf renderers before broadening their inputs; Hono JSX
cannot repair unsafe strings after they cross the trusted-HTML boundary.
Test special characters to catch both missing and double escaping.

### Development request flow

```text
GET /example-hydration/
    -> Vite's Hono development adapter loads server.ts
    -> read the authored HTML
    -> apply Vite's HTML transforms
    -> render Hono JSX fragments with intact Microtags render methods
    -> insert fragments and return text/html
```

Use [@hono/vite-dev-server][hono-dev] as the first integration to try.
Its implementation loads the app through Vite's SSR loader and provides
the Vite server through `c.env.vite`. The route can therefore use
`transformIndexHtml()` on the shell. Disable the adapter's
`injectClientScript` when using that transform, so one mechanism owns
development-client injection.

Scope the adapter to the hydration page routes. Preserve its asset
exclusions and let `/example/`, Vite internals, CSS, JS, and static assets
continue through Vite. Handle `/example-hydration/index.html` as well as
the directory URL, and redirect the path without a trailing slash.
Test requests with query strings. Do not set the adapter's global `base`
to the hydration route merely to scope routing; that setting also changes
Vite's base and could affect the other example.

Changes to the HTML, server fragments, or shared component rendering must
refresh the browser's server HTML. Prefer full-page reloads for component
module edits: re-executing `customElements.define()` in the same document
can fail, and the current builder registers unconditionally. Retain CSS
hot updates. Verify HTML file watching explicitly because a file read
through `fs` is not automatically an imported SSR module.

The dev adapter documents legacy SSR/HMR hooks. That does not prove
incompatibility with Vite 8, but source inspection is not a compatibility
test. Make Vite 8 routing and reload behavior the first integration spike.
If it fails, a narrowly scoped Vite `configureServer` middleware using
Hono's Node request adapter is the fallback. [Adapter documentation][hono-dev]

### Production build and request flow

Use Node as the initial runtime because this example already uses it.
Hono's [Node adapter][hono-node] provides the HTTP listener and static
asset middleware. Keep the app definition separate from the listener so
development and tests can load the app without opening another port.

1. Build the library and Node plugin entries that the example imports.
2. Build the authored HTML and browser assets with Vite. The built HTML
   retains its slots and gains the final script and stylesheet URLs.
3. Build `serve.ts` and its server imports with Vite's SSR build, preserving
   Microtags render methods. Put client and server output in separate
   directories within a dedicated example build directory, outside the
   library's `dist/`. Neither build may erase the other's output.
4. Start the built Hono server. Load the built HTML shell at startup,
   then render fragments and insert them for each page request.
5. Serve the emitted browser assets through static middleware. Route
   `/example-hydration/` and its HTML alias through Hono assembly so
   static middleware cannot return the unfinished template with slots.

```text
GET /example-hydration/
    -> built Hono app
    -> built HTML shell + freshly rendered fragments
    -> complete HTML response with built asset URLs

GET /assets/...
    -> emitted CSS or browser JavaScript
```

Use `/` as the initial Vite asset base. The page route remains
`/example-hydration/`; a route prefix and an asset base are separate
settings. Production does not load Vite's development server or call
`transformIndexHtml()`. Fail startup if the built shell is missing.

Page CSS stays linked in the shell; component CSS remains reachable from
the browser entry. Verify all CSS is linked in the response, including
when JavaScript is disabled. Any future assets introduced only inside
server fragments will need an explicit Vite asset path strategy.

If a rendered file is wanted, keep `ssr.ts` as an optional command that
calls the Hono route with the built shell and writes the response to
stdout or an output file. It must never overwrite the authored HTML.

## Implementation sequence and acceptance criteria

1. **Make stripping safe for server imports.** Update `src/vite.ts` to
   skip server environments. Vite documents
   `this.environment.config.consumer === 'server'`; retain an
   `options.ssr` fallback if supporting older Vite versions. Do not rely
   on build versus development mode: both modes have client and server
   modules. Add a regression test proving the same component retains
   rendering on the server and loses it in the browser build.
   [Vite environment migration][vite-environment]
2. **Run a small Hono/Vite integration spike.** Add Hono, its Node adapter,
   and the Vite dev adapter as example tooling, isolated from Microtags
   core dependencies. Hono and the Node adapter must be available to the
   production server, either bundled or installed as runtime dependencies
   of the example. Prove one route renders a counter, serves CSS, and
   refreshes after an edit under installed Vite 8. Select and record
   concrete compatible package versions here.
3. **Move the scaffold.** Remove the ignore entry for the hydration
   HTML, check in the authored shell, add the two fragments, and remove
   `page.ts`. Preserve the notice target, runtime assertions, reveal
   class, and `noscript` rule.
4. **Wire development and production serving.** Add the Hono assembly
   route, route scoping, template transformation, and production listener.
   Repair script naming and clean-checkout prerequisites.
   `start:hydration` should run development without generating source
   HTML; `build:hydration` should build client and server output; a new
   `serve:hydration` script should run that built server. Ignore the new
   build directory. Keep `ssr:hydration` only if stdout/export is useful.
5. **Update TypeScript and documentation.** Include the new TSX/server
   files in the appropriate checks. A child tsconfig does not configure
   files checked through the root project; adjust root inclusion or add
   an explicit example check. Keep browser library declarations free of
   example-only Node/Hono types. Update the hydration README and relevant
   AGENTS notes to describe the actual scripts.
6. **Verify development and production.** Check both servers' HTML
   responses, then exercise the production page in a browser. Run existing
   `npm run test:plugins`, `npm run test:ssr`, and `npm test`, together
   with the example typecheck and clean example build.

Vite 8 uses Oxc/Rolldown; older snippets commonly configure esbuild and
Rollup options. Prefer tsconfig for the Hono JSX import source and current
Vite options for new configuration. The repository's standalone esbuild
commands remain separate from Vite's internals. [Vite 8 migration][vite8]

Completion means:

- The full document is authored in a tracked `.html` file.
- Dev and production responses contain expanded counter and badge
  markup, initial value `5`, and all three list items before scripts run.
- No outlet comments, duplicate hosts, or double-escaped markup remain.
- Counter buttons, notice creation/dismissal, and runtime assertions work.
- Server rendering retains render methods; client stripping still works.
- The production client graph contains no Hono, React, server entry, or
  filesystem modules. The core library gains no runtime dependency.
- Page/component styles and asset URLs work with the configured base, and
  the no-JS page is visible and styled. It need not be interactive.
- HTML/component edits refresh dev output; the older example still works.
- A clean build produces a runnable Hono server and client assets without
  modifying `example-hydration/index.html`.
- Production serves complete HTML through Hono and runs without the Vite
  development server. Static middleware never exposes unfinished slots.

## Evidence, confidence, and remaining checks

Research used official Hono, Vite, React, and React Router documentation,
maintainer repositories, and this checkout. Documentation establishes API
behavior; source inspection establishes the repository-specific hazards.
Recommendations above are design judgments based on those findings.

A temporary Vite `8.3.0` build outside the repository tested the proposed
HTML build order with two comment outlets, a page stylesheet, and a
browser entry importing component CSS. Both outlets survived the build;
script and stylesheet URLs acquired hashes and a configured test prefix;
the source `.ts` script reference disappeared. All five checks passed.
This validates the asset-and-outlet premise with the installed Vite.

Hono is not installed, so no Hono/Vite combination was executed. The
adapter's exact Vite 8 compatibility, custom-element reload behavior,
JSX typing, and complete example build remain implementation checks.
No application regression suite was run for this documentation-only work.

The next concrete step is the small server/client stripping regression
and Hono route spike, followed by moving the scaffold once that boundary
works. Then verify the same route against the production build.

[adr]: adr/ADR-006-hono-html-scaffold.md
[page]: ../example-hydration/page.ts
[ssr]: ../example-hydration/ssr.ts
[client]: ../example-hydration/index.ts
[ignore]: ../.gitignore
[package]: ../package.json
[config]: ../vite.config.ts
[plugin]: ../src/vite.ts
[builders]: ../src/builders.ts
[hono-dom]: https://hono.dev/docs/guides/jsx-dom
[hono-jsx]: https://hono.dev/docs/guides/jsx
[hono-renderer]: https://hono.dev/docs/middleware/builtin/jsx-renderer
[hono-workers]: https://hono.dev/docs/getting-started/cloudflare-workers-vite
[hono-node]: https://hono.dev/docs/getting-started/nodejs
[hono-html]: https://hono.dev/docs/helpers/html
[hono-ssg]: https://hono.dev/docs/helpers/ssg
[hono-vite-ssg]: https://github.com/honojs/vite-plugins/tree/main/packages/ssg
[hono-dev]:
  https://github.com/honojs/vite-plugins/tree/main/packages/dev-server
[ssr-components]: https://github.com/yusukebe/vite-ssr-components
[vite-ssr]: https://vite.dev/guide/ssr
[vite-backend]: https://vite.dev/guide/backend-integration
[vite-environment]: https://vite.dev/changes/this-environment-in-hooks
[vite8]: https://vite.dev/guide/migration
[react-template]:
  https://github.com/bluwy/create-vite-extra/tree/master/template-ssr-react
[react-hydrate]: https://react.dev/reference/react-dom/client/hydrateRoot
[react-stream]: https://react.dev/reference/react-dom/server/renderToPipeableStream
[react-root]: https://reactrouter.com/api/framework-conventions/root.tsx
[react-adoption]: https://reactrouter.com/upgrading/router-provider
[react-scripts]: https://reactrouter.com/api/components/Scripts
