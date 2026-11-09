# Hydration

Hydration means writing HTML as a string on the server, then
compiling JS for the page to add interactivity. It gets you faster initial page
load, plus the behavior of a
[single page app](https://developer.mozilla.org/en-US/docs/Glossary/SPA).

<details><summary><h2>Contents</h2></summary>

<!-- toc -->

- [Running this example](#running-this-example)
- [State](#state)
- [Files in this folder](#files-in-this-folder)
- [`.render`](#render)
- [`.html`](#html)
  * [Self-closing tags](#self-closing-tags)
  * [`children`](#children)
  * [Returning `html` from `.render`](#returning-html-from-render)
- [Nesting components and lists](#nesting-components-and-lists)
- [Stripping `.render` from the client bundle](#stripping-render-from-the-client-bundle)
  * [1. Vite plugin](#1-vite-plugin)
  * [2. esbuild plugin](#2-esbuild-plugin)
  * [3. `microbuild` CLI](#3-microbuild-cli)
  * [4. `transform` function](#4-transform-function)
- [Keeping `.render` on the client](#keeping-render-on-the-client)

<!-- tocstop -->

</details>


## Running this example

All scripts run from the repo root. Each one that uses the Vite config
builds the Node entries (`npm run build:node`) first, because the config
imports the stripping plugin from `dist/vite.js`.

- `npm run start:hydration` -- start the Vite dev server with the Hono
  app mounted under `/example-hydration/`, and open the index.
- `npm run ssr:hydration` -- print one assembled page to stdout. Pass a
  route after `--`, for example `npm run ssr:hydration -- /list`. The
  default is the index.
- `npm run build:hydration` -- production build: a client build and a
  server build into `build/client` and `build/server` (gitignored).
- `npm run serve:hydration` -- run the built production server. Set
  `PORT` to choose the port.
- `npm run test:hydration` -- build, then test the app with
  `app.request()` and the built listener.
- `npm run test:hydration-dev` -- start the dev server and fetch the
  routes over HTTP.
- `npm run typecheck:hydration` -- type-check `server/` with Node types.
- `npm run test:e2e` -- Playwright tests against the production server.
- `npm run toc:hydration` -- regenerate this file's table of contents.
- `npm run gate` -- run every check in the repo, cheapest first: lint,
  build, typecheck, size, then the browser, SSR, build, plugins, CLI and
  hydration suites, and the dev-server test. It stops on the first
  failure. Playwright is not part of it; run `npm run test:e2e`
  separately.

The Playwright browser is a one-time install:

```sh
npx playwright install chromium
```

The routes are `/example-hydration/` (a counter with a nested badge),
`/example-hydration/list` (a keyed list of badges with add and remove
controls), and `/example-hydration/notice` (a notice shown and dismissed
through state). Any other path, under the prefix or outside it, returns
the not-found page with a 404. The index route accepts a `count` query
parameter when it is a finite integer, for example
`/example-hydration/?count=10`.

## State

`state.ts` runs on both sides. `State(input)` builds an `AppState`, one
signal per JSON value (`route`, `count`, `noticeOpen`, `labels`,
`heading`, `badgeLabel`), and fills defaults for missing keys. Signals
are written only through the static functions on `State`, such as
`State.increase(state)`. `serialize(state)` returns the plain JSON form,
typed as `Serialized<AppState>`. Pages read nothing but this state, so
the browser mounts exactly what the server rendered: `createApp` takes
no page content of its own.

The server builds state for each request, renders the page from it, and
writes `serialize(state)` into the document as a JSON script with the id
`STATE_ID`. The browser reads that script, calls `State` with it, and
mounts the same layout and page over the server-rendered DOM. From then
on a state change updates the parts of the DOM that depend on it. Routing
stays on the server: every link is a full page load.

## Files in this folder

- `index.html` -- the checked-in page scaffold, and the Vite HTML entry.
  It has two markers. `<div id="root">` holds
  `<!--microtags:main-->`, which the server replaces with the rendered
  layout and page. `<!--microtags:state-->`, before the module script,
  is replaced with the state script. Nothing writes to this file.
- `state.ts` -- the shared app state, described [above](#state).
- `vite.config.ts` -- this example's own Vite config: aliases, the
  stripping plugin, the Hono dev server, and both production builds.

**`client/` runs only in the browser**:

- `index.ts` -- the client entry. It imports the components, which
  registers them, reads the state script, and mounts the layout into
  `#root`. It also runs a few runtime assertions and prints the results
  on the page: `Counter.render` is `undefined` in the browser bundle,
  and `Notice.render` and `Badge.render` are still functions. It
  imports `Badge` and `Notice` before `Counter`, which nests them. See
  [the cascade note](#nesting-components-and-lists) for why.
- `index.css` -- page-level styles.

`components/` runs on both sides:

- `counter.ts` -- a view of a `count` prop it does not own. Its buttons
  emit `increment` and `decrement`. Its `.render` nests a `Badge`, and
  its setup binds a derived value to that badge's `label` prop with
  `bindProp`. Its render is stripped.
- `badge.ts` -- shows its `label` prop. Kept with `{ client: true }`
  because the list page creates badges in the browser. Its setup
  writes the label text only when it differs from the text already in
  the element. Any setup that writes content the server rendered should
  do the same, so hydrating a page changes nothing in the DOM.
- `notice.ts` -- a message whose dismiss button emits `dismiss`. Kept
  with `{ client: true }`.
- `counter.css`, `badge.css` -- component styles. Under plain esbuild
  they load as empty modules (`--loader:.css=empty`).

`pages/` runs on both sides:

- `layout.ts` -- the navigation and `<main>` around a page. Each link
  binds `aria-current` to the `route` signal.
- `index.ts`, `list.ts`, `notice.ts`, `not-found.ts` -- one page
  function per route, each taking the app state.
- `routes.ts` -- the route table. `pageFor(route)` returns the page for
  a route, or the not-found page.

`server/` runs only in Node:

- `app.ts` -- the Hono app and its routes. It has no Node imports and
  takes an injectable scaffold loader.
- `scaffold.ts` -- loads the scaffold and replaces the marker.
- `listen.ts` -- the production server. It loads the built scaffold,
  mounts the app, and serves built assets.
- `ssr.ts` -- the stdout render command.
- `tsconfig.json` -- type-checks this folder with Node types.

---

## `.render`

Write your components with a
[`.render`](../README.md#builderrenderfn-options) method.
The function passed to `.render` gets called with a `context` object.

This package exposes two paths, `microtags/esbuild` and `microtags/vite` that
provide plugins that will strip the `.render` function from the client build,
which keeps the clientside bundle small.

Add a `.render` call in the method chain, before `.setup`. The render function
receives `props` (plain values, not signals), `refs`, `TAG`, `children`,
and `attrs`, and should return the host element's inner HTML.

`props` and `attrs` are both attributes on the tag, split by whether the
name was declared in `.withProps`. A declared name, like `start` below, is
a prop: it is coerced to its declared type (`5`, a number) and is what
`.setup` reads on the client. Any other attribute, like `class` or `id`,
is passed through as a plain string in `attrs`. Both are written to the
host tag. `attrs` is there so the render function can react to them, for
example to forward `class` to an inner element.

```ts
// one file for markup and behavior
import { signal } from 'alien-signals'
import { define } from 'microtags'

export const HydraCounter = define('hydra-counter')
    .withProps(p => ({
        // `start` attribute is coerced to a number
        start: p.number()
    }))
    .withRefs(r => ({
        display: r.one<HTMLDivElement>(),
        inc: r.one<HTMLButtonElement>(),
    }))
    .render(({ props, refs, attrs }) => {  // serverside only
        // `class` is not a declared prop, so it arrives in `attrs`
        const cls = attrs.class ?? ''
        return `
            <div data-ref="${refs.display}" class="${cls}">${props.start}</div>
            <button data-ref="${refs.inc}">+</button>`
    })
    .setup(ctx => {  // clientside only
        const count = signal(ctx.props.start())
        ctx.effect(() => {
            ctx.refs.display.textContent = String(count())
        })
        ctx.on(ctx.refs.inc, 'click', () => count(count() + 1))
    })
```

## `.html`

On the server, components should be rendered with the
[`html`](../README.md#microtagshtm)
[tagged template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates),
or you can call the static `HydraCounter.render(props)` directly.
`html` knows how to expand every component,
eg `<${MyComponent} start="5"><//>`, into its content, which is the HTML
returned by `.render`. The `<//>` is `htm` shorthand for the closing tag,
so you do not have to repeat the component name.

```ts
// runs in Node
import { html } from 'microtags/htm'
import { HydraCounter } from './counter.js'

export function page ():string {
    return html`<main>
        <${HydraCounter} start=${5} class="big"><//>
    </main>`
}
```

The output is the expanded HTML, with props serialized
as attributes, so `.setup`, which runs on the client, can read the
`start` attribute. The undeclared `class` attribute is also written to
the host tag, and the render function copied it onto the inner `div`.

```html
<main>
    <hydra-counter start="5" class="big">
        <div data-ref="display" class="big">5</div>
        <button data-ref="inc">+</button>
    </hydra-counter>
</main>
```

Calling the static method directly takes the same two parameters as
separate arguments:

```ts
HydraCounter.render({ start: 5 }, { attrs: { class: 'big' } })
```

See [`builder.render`](../README.md#builderrenderfn-options) for the
full reference.

### Self-closing tags

Inside `html` a component can be written as `<${HydraCounter} start=${5} />`,
which is what the `pages/` modules and `client/index.ts` do. That is fine
because `html` always emits a real closing tag in the output. It is only
in hand-written HTML that a custom element must not be self-closed, since
the browser would parse everything after it as its children.

### `children`

Anything between the open and close tags is passed to the render function
as `children`, already rendered to a string. `counter.ts` emits
`${children}` at the end of its markup, so this:

```ts
html`<${Counter} start=${5}><p>Extra content</p><//>`
```

puts the paragraph after the buttons. The static form is
`Counter.render({ start: 5 }, { children: '<p>Extra content</p>' })`.

### Returning `html` from `.render`

The render function can return `html` instead of a plain string. Every
interpolated string is escaped, so a prop value containing `<` comes out
as `&lt;`, which a plain template literal does not do. Nested components
go inline as `<${Badge} ... />`. `components/counter.ts` is written
this way.

The one thing to watch is `children`. It reaches the render function as
an already-rendered string, so passing it through `html` would escape the
markup. Wrap it in `raw()` to insert it as is.

```ts
import { define } from 'microtags'
import { html, raw } from 'microtags/htm'
import { Badge } from './badge.js'

export const Counter = define('hydra-counter')
    .withProps(p => ({
        start: p.number(),
    }))
    .withRefs(r => ({
        display: r.one<HTMLDivElement>(),
        inc: r.one<HTMLButtonElement>(),
    }))
    .render(({ props, refs, children }) => {
        return html`
            <div data-ref=${refs.display} class="count">${props.start}</div>
            <${Badge} label=${String(props.start)} />
            <button data-ref=${refs.inc}>+</button>
            ${raw(children)}`
    })
    .setup(ctx => {
        // ...
    })
```

`html` writes attribute values in quotes for you, so `data-ref=${refs.inc}`
is enough. Rendering `<${Counter} start=${5}><p>Extra</p><//>` then gives:

```html
<hydra-counter start="5">
    <div data-ref="display" class="count">5</div>
    <hydra-badge label="5"><span>5</span></hydra-badge>
    <button data-ref="inc">+</button>
    <p>Extra</p>
</hydra-counter>
```

Without `raw()` the last line would be `&lt;p&gt;Extra&lt;/p&gt;`.

## Nesting components and lists

A render function can nest other components. `counter.ts` puts a
`Badge` inline in its `html` template. The badge also carries the
counter's `current` ref, so `.setup` can update the badge text when the
count changes:

```ts
import { html } from 'microtags/htm'
import { Badge } from './badge.js'

// ...
    .render(({ props, refs, children }) => {
        return html`
            <div role="status" class="count">...</div>
            <div class="current">
                <span>Current:</span>
                <${Badge}
                    data-ref="${refs.current}"
                    class="number"
                    label=${String(props.start)}
                />
            </div>
            ...`
    })
```

`data-ref` and `class` are not declared props of `Badge`, so they are
written to the `<hydra-badge>` host tag as plain attributes.

Because `Badge` and `microtags/htm` are only used inside `.render`, they
are dead code on the client once the render function is stripped. The
`cascade` option removes those imports too. Without it they stay in the
bundle. See [Stripping](#stripping-render-from-the-client-bundle).

Removing an import changes the order modules are evaluated in. Before
stripping, importing `counter.ts` evaluates `badge.ts` first, so
`hydra-badge` is defined before `hydra-counter`. After stripping,
`counter.ts` no longer imports `badge.ts`, and the order follows the
client entry's imports. That is why `client/index.ts` imports the leaf
components (`Badge`, `Notice`) before `Counter`: child hosts are then
defined, and upgraded, before the parents that nest them.

For a list, map over the array. Inside an `html` template the array is
flattened for you:

```ts
html`<ul>
    ${items.map(item => html`<li><${Badge} label=${item}/></li>`)}
</ul>`
```

Inside a plain template string, join it yourself:

```ts
`<ul>
    ${items.map(item => html`<li><${Badge} label=${item} /></li>`).join('')}
</ul>`
```


## Stripping `.render` from the client bundle

Without a build step the render function ships to every browser. The
transform function in [`microtags/build`](../README.md#microtagsbuild)
removes each `.render` link from a `define` chain and leaves everything
else unchanged.

There are four ways to run it. All four accept the same two options:

- `keep` -- a list of tag names whose render stays in the bundle. See
  [Keeping `.render` on the client](#keeping-render-on-the-client).
- `cascade` -- also remove imports and top-level declarations that are only
  used by the `.render` function, such as `microtags/htm` or a child component
  imported for nesting. Without it, those imports stay in the bundle.

### 1. Vite plugin

```ts
// vite.config.ts
import { microtags } from 'microtags/vite'

export default {
    plugins: [
        microtags({ cascade: true }),
    ],
}
```

The real config for this example, [`vite.config.ts`](./vite.config.ts),
adds two things to the minimal version above:

- A `filter` regex so the plugin only transforms files in
  `client/` and `components/`. Server modules keep their render links.
- `resolve.alias` entries that map `microtags` and `microtags/htm` to
  `src/`, so the dev server runs against the source instead of `dist/`.
  Your own project imports the published package and does not need this.

### 2. esbuild plugin

```ts
import { build } from 'esbuild'
import { microtags } from 'microtags/esbuild'

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'public',
    plugins: [microtags({ cascade: true })],
})
```

Both plugins take an optional `filter` regex that limits which files are
transformed. The default matches `.ts`, `.js`, and `.mjs`.
Transform warnings are forwarded to the bundler.


### 3. `microbuild` CLI

For a pipeline without a bundler, or to inspect the stripped output:

```sh
# one file, stdin to stdout
cat src/counter.ts | microbuild --cascade > dist/counter.ts

# many files, mirrored into --outdir
microbuild 'src/**/*.ts' --outdir dist --cascade --keep my-notice
```

Files are never rewritten in place. See
[`microbuild`](../README.md#microbuild).


### 4. `transform` function

The plugins and the CLI call this. Can use it in a custom build tool or a test.

```ts
import { transform } from 'microtags/build'

const { code, warnings } = transform(source, {
    cascade: true,
    filename: 'counter.ts',
})
```

The exact match rule, the unsupported forms, and the warning kinds are
in the [`microtags/build`](../README.md#microtagsbuild) reference.


## Keeping `.render` on the client

Some components must render themselves in the browser, for example a
notice that is only shown under certain conditions. There are two ways to
keep the render function:

* In source code, pass `{ client: true }` as the second argument to
  `.render`. The decision travels with the component and applies in every build.
* At build time, list the tag name in `keep` (the plugin option or the
  `--keep` flag). The source is unchanged.

A render is kept when either applies. See
[`client:true` vs `--keep`](../README.md#clienttrue-vs---keep) for when
to use each.

```ts
export const Notice = define('hydra-notice')
    .withProps(p => ({ message: p.string() }))
    .render(({ props }) => {
        return `<p>${props.message}</p>`
    }, { client: true })
    .setup(ctx => {
        // ...
    })
```

The static `render` then exists in the browser, so the browser can
create the component. `pages/notice.ts` shows the notice in a reactive
region driven by state:

```ts
html`${() => state.noticeOpen() ?
    html`<${Notice} message=${'Saved'}
        ondismiss=${() => State.dismissNotice(state)} />` :
    ''}`
```

> [!NOTE]
> After stripping, the static `render` is `undefined` at runtime even
> though the type still declares it. Calling `render` on a stripped
> component in the browser throws.
