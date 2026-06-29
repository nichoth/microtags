# microtags

[![tests](https://img.shields.io/github/actions/workflow/status/nichoth/microtags/nodejs.yml?style=flat-square)](https://github.com/nichoth/microtags/actions/workflows/nodejs.yml)
[![types](https://img.shields.io/npm/types/microtags?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![install size](https://flat.badgen.net/packagephobia/install/microtags?cache-control=no-cache)](https://packagephobia.com/result?p=microtags)
[![gzip size](https://img.shields.io/bundlephobia/minzip/microtags?style=flat-square)](https://bundlephobia.com/package/microtags)
[![license](https://img.shields.io/badge/license-Big_Time-blue?style=flat-square)](LICENSE)

Web component helper with reactive props, automatic cleanup, and no
[Shadow DOM](https://gomakethings.com/the-shadow-dom-is-an-antipattern/).
Reactive via [alien-signals](https://github.com/stackblitz/alien-signals).

**Size: 3.41 KB** with all dependencies, minified and brotlied

Inspired by [nanotags](https://nanotags.psdcoder.dev/). Reactive props use
**alien-signals** instead of nanostores atoms.

<details><summary><h2>Contents</h2></summary>

<!-- toc -->

- [Install](#install)
  * [Import map](#import-map)
  * [Pre-bundled](#pre-bundled)
- [Example](#example)
  * [Client-side validation](#client-side-validation)
- [Serverside Example](#serverside-example)
  * [`.TAG`](#tag)
  * [`.refs`](#refs)
- [API](#api)
  * [Props](#props)
    + [`withProps`](#withprops)
  * [Refs](#refs)
    + [`withRefs`](#withrefs)
    + [Element types](#element-types)
  * [`define`](#define)
  * [`withContexts`](#withcontexts)
  * [`setup` and `ctx`](#setup-and-ctx)
    + [peek and untracked](#peek-and-untracked)
- [Templates](#templates)
- [Subpath Exports](#subpath-exports)
  * [`microtags/context`](#microtagscontext)
  * [`microtags/render`](#microtagsrender)
    + [`renderList`](#renderlist)
    + [`render`](#render)
    + [Templates](#templates-1)
  * [`microtags/util`](#microtagsutil)
    + [Coercion](#coercion)
    + [`runCleanups`](#runcleanups)
- [Divergence from `nanotags`](#divergence-from-nanotags)
  * [Reactivity primitive](#reactivity-primitive)
  * [Effects + Subscriptions](#effects--subscriptions)
  * [Refs: `r.all` instead of `r.many`](#refs-rall-instead-of-rmany)
  * [Context API](#context-api)
  * [Props](#props-1)
  * [Not ported](#not-ported)
  * [Additions / New Features](#additions--new-features)

<!-- tocstop -->

</details>

----------------------------------------------------------------------
## Install
----------------------------------------------------------------------

```sh
npm i -S microtags
```

### Import map

No build step needed. Resolve `microtags` with an
[import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)
and `esm.sh`.


```html
<script type="importmap">
{
    "imports": {
        "microtags": "https://esm.sh/microtags"
    }
}
</script>

<script type="module">
    import { define } from 'microtags'
</script>
```

Subpaths follow the same URL pattern: `microtags/context`, `microtags/render`.

### Pre-bundled

For raw-file CDNs (jsDelivr, unpkg) or local files, where dependencies are
not resolved for you, use the pre-bundled `microtags/min` build. It is a
single self-contained file with `alien-signals` inlined, so no other
mappings are needed:

```html
<script type="importmap">
{
    "imports": {
        "microtags": "https://cdn.jsdelivr.net/npm/microtags/dist/index.min.js"
    }
}
</script>
```


----------------------------------------------------------------------
## Example
----------------------------------------------------------------------

This example depends on having the full HTML already in the DOM. If you want
to do client-side-rendered components, that is possible. You would update the
DOM inside `.setup`.

Since the full HTML exists already, defining your components in the
client-side JS is about "hydrating" the page (adding behavior).

---

`withProps`, `withRefs`, and `withContexts` are optional and can appear in
any order. `.setup` ends the chain: it calls `customElements.define` under the
hood and returns a typed constructor.

```ts
import { define } from 'microtags'
import { signal } from 'alien-signals'

/**
 *  - attribute-backed prop (`start`)
 *  - data-ref elements (the <count-button> and <copy-btn> children)
 *  - ctx.effect, ctx.on
 */
export const myCounter = define('my-counter')
    .withProps(p => ({
        start: p.number(),
    }))
    .withRefs(r => ({  // the keys in this object are the ref names
        display: r.one<HTMLDivElement>(),  // typed as HTMLDivElement
        inc: r.one(),  // defaults to HTMLElement
        dec: r.one(),
        copy: r.one(),
    }))
    .setup(ctx => {
        // all event <-> state logic here
        const count = signal(ctx.props.start())
        const display = ctx.refs.display

        ctx.effect(() => {
            display.textContent = `Count: ${count()}`
            display.style.color = count() < 0 ? 'red' : 'inherit'
        })

        // Reflect the live count onto the copy button's `value` attribute.
        // Because `value` is attribute-backed, this flows into <copy-btn>'s
        // own signal, so it always copies the current count.
        ctx.effect(() => {
            const copy = ctx.refs.copy
            copy.setAttribute('value', String(count()))
        })

        ctx.on(ctx.refs.inc, 'click', () => {
            count(count() + 1)
        })

        ctx.on(ctx.refs.dec, 'click', () => {
            count(count() - 1)
        })
    })
```

```html
<my-counter start="5">
    <div data-ref="display"></div>
    <button data-ref="dec">-</button>
    <button data-ref="inc">+</button>
</my-counter>
```

### Client-side validation

See [example/subscribe-form.ts](./example/subscribe-form.ts).

There are two separate things people call "validation", and `microtags`
handles them in different places:

1. **Prop validation** checks the attributes passed *into* a component.
   Pass a [Standard Schema](https://standardschema.dev) (Zod, Valibot,
   ArkType) to [`p.schema`](#withprops); it coerces the attribute value
   and falls back to `undefined` when the value doesn't match.
2. **Form input validation** checks live user input in a form, for example a
   value that changes on every keystroke and needs to report *why* it is invalid.
   There is no dedicated API for this. Validate the schema directly
   inside `.setup()` and hold the result in a signal:

The example below is the second kind -- form input (client-side) validation.

```ts
import { signal, startBatch, endBatch } from 'alien-signals'
import { z } from 'zod'
import { define } from 'microtags'

const Email = z.email('Please enter a valid email address.')

define('subscribe-form')
    .withRefs(r => ({
        form: r.one('form'),
        input: r.one('input'),
        submit: r.one('button'),
        error: r.one('.error'),
        status: r.one('.status'),
    }))
    .setup(ctx => {
        const value = signal('')
        const touched = signal(false)

        // capture the live value (two-way; clears the field on reset)
        ctx.bind(value, ctx.refs.input)
        // only reveal errors after the first blur
        ctx.on(ctx.refs.input, 'blur', () => touched(true))

        ctx.effect(() => {
            const result = Email.safeParse(value())
            const message = result.success ?
                '' :
                result.error.issues[0].message
            const showError = touched() && !result.success

            ctx.refs.submit.disabled = !result.success
            ctx.refs.input.setAttribute('aria-invalid', String(showError))
            ctx.refs.error.textContent = showError ? message : ''
        })

        ctx.on(ctx.refs.form, 'submit', ev => {
            ev.preventDefault()
            if (!Email.safeParse(value()).success) return
            ctx.refs.status.textContent = 'Thanks for subscribing!'
            startBatch()
            value('')
            touched(false)
            endBatch()
        })
    })
```

The error stays hidden until the field is blurred once, then updates live;
the submit button is gated on validity. See `example/subscribe-form.ts`
for the full working component.


----------------------------------------------------------------------
## Serverside Example
----------------------------------------------------------------------

### `.TAG`

Each tag name that you pass to `define` is exposed as a property `.TAG`
on the return value. It is possible to import your web components in Node,
even though Node does not have browser APIs.

### `.refs`

All refs are defined per-component, and the ref names are exposed at `.refs`,
so you can import your web components on the server and read the ref names
as strings.

```ts
import { MyCounter, CountBtn, CopyBtn } from './index.js'

// this runs in Node

export function render ():string {
    return `<div>
        <${MyCounter.TAG} start="${START}">
            <div data-ref="${MyCounter.refs.display}"
                role="status"
                class="count"
            >${START}</div>

            <div class="controls">
                <${CountBtn.TAG}
                    class="dec"
                    data-ref="${MyCounter.refs.dec}"
                    aria-label="Decrement"
                >
                    <button>-</button>
                </${CountBtn.TAG}>

                <${CopyBtn.TAG}
                    class="copy"
                    data-ref="${MyCounter.refs.copy}"
                ></${CopyBtn.TAG}>

                <${CountBtn.TAG}
                    class="inc"
                    data-ref="${MyCounter.refs.inc}"
                    aria-label="Increment"
                >
                    <button>+</button>
                </${CountBtn.TAG}>
            </div>
        </${MyCounter.TAG}>
    </div>`
}
```

----------------------------------------------------------------------
## API
----------------------------------------------------------------------

### Props

Declare reactive attributes via `withProps`. Each prop becomes:

* An observed HTML attribute (auto-synced via `attributeChangedCallback`)
* A signal at `ctx.props.propName`
* A typed getter/setter on the element instance
* Four built-in validators coerce raw attribute strings to typed values:

| Validator | Coercion | `null` attr |
|-----------|----------|-------------|
| `p.string()` | `String(val)` | `""` |
| `p.number()` | `Number(val)` | `0` |
| `p.boolean()` | `"true"` / `""` &rarr; `true`, `"false"` &rarr; `false` | `false` |
| `p.oneOf(opts)` | Picklist enum, throws on invalid | throws |

#### `withProps`

```ts
.withProps(p => ({
    count:   p.number(),           // attribute -> number  (NaN when absent)
    label:   p.string(),           // attribute -> string  ('' when absent)
    active:  p.boolean(),          // attribute -> boolean (true if present)
    data:    p.json<MyType>(),     // attribute -> JSON.parse or undefined
    schema:  p.schema(zodSchema),  // Standard Schema (Zod, Valibot, ArkType)
    value:   p.prop(0),            // property-only, not an observed attribute
}))
```

##### `p.json`

`p.json<T>()` -- a prop whose attribute value is parsed with
`JSON.parse`. The type parameter `T` annotates the parsed result; it is a
type only, so the value is not validated at runtime. The resulting signal is
typed `T | undefined`.

```ts
.withProps(p => ({
    user: p.json<{ id:number; name:string }>(),
}))
```

```html
<my-el user='{"id":1,"name":"Alice"}'></my-el>
```

Like the string/number/boolean validators it is attribute-backed and
observed, so editing the attribute re-parses and pushes the new value to
`ctx.props.user`. It falls back to `undefined` in two cases: when the
attribute is absent, and when the value is not valid JSON. Parse errors are
swallowed rather than thrown.

```ts
// check for `undefined` case
ctx.effect(() => {
    const user = ctx.props.user()
    if (!user) return
    ctx.refs.name.textContent = user.name
})
```

For input you want validated rather than only parsed, pass a Standard Schema
to [`p.schema`](#withprops) instead.

Inside `setup()`, every prop is a callable signal:

```ts
ctx.props.count()      // read
ctx.props.count(42)    // write
```

---

### Refs

The `data-ref` attribute is a fallback. It's used when you don't pass a
selector to `r.one()`. If you pass explicit CSS selectors to `withRefs`,
e.g. `{ copy: r.one('button') }`, then the HTML does not require a `data-ref`
attribute.

#### `withRefs`

Call `r.one()` / `r.all()` with no argument to match `[data-ref="<key>"]`,
where `key` is the key name you pass in, or pass a CSS selector to query by
it instead. Queries are resolved relative to the host element, during
[the `connectedCallback`](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks).


```ts
.withRefs(r => ({
    button: r.one(),   // resolves [data-ref="button"] (throws if missing)
    items:  r.all(),   // resolves all [data-ref="items"] (empty array if none)
}))
```

If there are no `data-ref` attribtues in the HTML, use CSS query selectors.

```ts
.withRefs(r => ({
    code:  r.one('code'),    // host.querySelector('code')
    items: r.all('li'),      // host.querySelectorAll('li')
}))
```

See [#refs in serverside-rendering](#refs). Each component created with
`micortags` exposes a `.refs` property that is an object map
of ref names, eg `MyComponent.refs.copyButton`.

#### Element types

An un-annotated `r.one()` is typed as `HTMLElement`, so `.style`,
`.textContent`, and `.dataset` work without a cast. There are two ways to
get a more specific element type:

```ts
.withRefs(r => ({
    // Generic argument: sets the type, keeps the [data-ref] selector.
    display: r.one<HTMLDivElement>(),

    // Tag string: infers the type AND queries by that tag, exactly like
    // document.querySelector('button'). It does NOT keep [data-ref].
    save:    r.one('button'),     // SingleRefDef<HTMLButtonElement>
    items:   r.all('li'),         // MultipleRefDef<HTMLLIElement>
    button:  r.one(),             // HTMLElement (un-annotated default)
}))
```

These flow straight through to `ctx.refs`:

```ts
ctx.refs.display  // HTMLDivElement
ctx.refs.save     // HTMLButtonElement
ctx.refs.items    // HTMLLIElement[]
ctx.refs.button   // HTMLElement (the un-annotated default)
```

Non-HTML refs (SVG / MathML) are out of scope: the type parameter is
constrained to `HTMLElement`, so cast at the use site if you need one
(e.g. `ctx.refs.icon as unknown as SVGSVGElement`).


### `define`

```ts
import { define } from 'microtags'

define(tagName:string):ComponentBuilder
```

Returns a fluent builder. Call `.setup()` to register the custom element.
All builder methods are chainable and fully type-inferred.

### `withContexts`

Context is for the case where a parent component defines some state, e.g. a
`theme`, and the top-level (application) knows nothing about the theme. But the
top level application does determine what children the parent renders
(it passes in children), and the children need to know the theme.

In that case, there is no way for the "parent" component to pass the theme to
the children, and the root level (application) doesn't know what the theme is.

Context gives us a "pull" based way to model this. The context-provider
publishes the value, and any descendants opt in (or pull values) with
`withContexts`, and the unknown-consumer and late-arrival problems are handled. 

>
> [!IMPORTANT]  
> Context is only relevant on the client-side.
> Context gives you nothing for first paint or the no-JS case.
>


```ts
import { define } from 'microtags'
import { createContext, provide } from 'microtags/context'

const ThemeToken = createContext<string>()

// Parent: owns the theme and publishes it to its descendants. It does
// not reference the children below. The application composes those in.
define('theme-provider')
    .setup(ctx => {
        ctx.onCleanup(provide(ctx.host, ThemeToken, 'dark'))
    })

// Child: opts in to the theme and reads whichever provider it is
// composed into. It never receives the value as a prop.
define('themed-card')
    .withContexts(() => ({
        theme: ThemeToken,
    }))
    .setup(ctx => {
        ctx.effect(() => {
            ctx.host.dataset.theme = ctx.contexts.theme
        })
    })
```

```html
<!-- The application writes this markup. It nests <themed-card> inside
     <theme-provider> but never sets the theme itself. -->
<theme-provider>
    <themed-card>Card content</themed-card>
</theme-provider>
```

`setup()` is deferred until all required contexts resolve. See
[`microtags/context`](#microtagscontext) for the provider API.

### `setup` and `ctx`

```ts
.setup(ctx => {
    // ctx.host       the HTMLElement itself
    // ctx.props      callable signals for each declared prop
    // ctx.refs       resolved DOM refs
    // ctx.contexts   consumed context values (reactive)

    // Run a tracked effect; auto-disposed on disconnect.
    ctx.effect(() => {
        document.title = ctx.props.label()
    })

    // Bind a DOM property to a signal expression; auto-cleaned.
    ctx.bind(() => String(ctx.props.count()), el, { prop: 'textContent' })

    // Add an event listener; auto-removed on disconnect.
    ctx.on(el, 'click', handler)

    // Dispatch an event from the host. Pass a name (with optional
    // detail/options) for a bubbling CustomEvent, or a pre-built
    // Event. Returns dispatchEvent's result.
    ctx.emit('change', { value: 42 })

    // Read a signal without creating a subscription.
    const snap = ctx.peek(ctx.props.count)

    // Register arbitrary teardown logic.
    ctx.onCleanup(() => { /* ... */ })

    // Consume a context imperatively (returns value or undefined).
    const theme = ctx.consume(ThemeToken)
})
```

#### peek and untracked

When you need a non-subscribing read outside of `ctx.peek`, both helpers are
exported from the main entry:

```ts
import { peek, untracked } from 'microtags'

ctx.effect(() => {
    const current = peek(ctx.props.count)   // does NOT subscribe
    untracked(() => {
        // reads inside here do not subscribe either
    })
})
```

## Templates

[`render` and `renderList`](#microtagsrender) both take a `<template>`
element as their second argument. A
[`<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template)
is a native HTML element that holds markup the browser parses but does not
render. Its contents are inert. Nothing inside paints, scripts do not run,
images and other resources do not load, and the nodes stay out of the
document until you clone them.

See [./example/ssr.ts, line 89](./example/ssr.ts#L89).

You write the markup for an item inside the template, and the
reconciler stamps out a copy per item by cloning `template.content`. The
template's first element child is the unit that gets cloned, so give each
template a single root element.

```html
<item-list>
    <ul></ul>
    <template>
        <li>
            <span class="name"></span>
            <span class="count"></span>
        </li>
    </template>
</item-list>
```

The component resolves the list and the template as refs, then calls
`renderList` from inside an effect so the list re-renders whenever the
data signal changes.

```ts
import { define } from 'microtags'
import { signal } from 'alien-signals'
import { renderList } from 'microtags/render'

type Item = { id:string; name:string; count:number }

define('item-list')
    .withRefs(r => ({
        list: r.one('ul'),
        row: r.one('template'),  // typed as HTMLTemplateElement
    }))
    .setup(ctx => {
        const items = signal<Item[]>([
            { id: 'a', name: 'Alice', count: 1 },
            { id: 'b', name: 'Bob', count: 2 },
        ])

        // Re-runs on every items() change; only changed rows are touched.
        ctx.effect(() => {
            renderList(ctx.refs.list, ctx.refs.row, {
                data: items(),
                key: item => item.id,
                update: (el, item) => {
                    el.querySelector('.name')!.textContent = item.name
                    el.querySelector('.count')!.textContent =
                        String(item.count)
                },
            })
        })
    })
```

Because the template lives in your HTML instead of a JavaScript string, each
render clones real DOM nodes rather than re-parsing HTML, and the `update`
callback function mutates the DOM through properties like `textContent`.
Nothing concatenates strings into markup, so there is no string-injection
XSS vector.

## Subpath Exports

### `microtags/context`

Cross-component context backed by alien-signals. A provider shares a value
with everything nested inside it; a consumer reads the value from its nearest
provider ancestor and reacts when it changes.

`provide` seeds a signal the first time it runs and updates that same signal
on later calls, so re-providing inside an effect pushes changes to consumers.

```ts
import { define } from 'microtags'
import { signal } from 'alien-signals'
import { createContext, provide } from 'microtags/context'

const ThemeToken = createContext<string>()

// Provider: owns the theme and shares it with its descendants.
define('theme-provider')
    .withRefs(r => ({
        toggle: r.one('button'),
    }))
    .setup(ctx => {
        const theme = signal('light')

        // Share with descendants; remove the entry on disconnect.
        const cleanUp = provide(ctx.host, ThemeToken, theme())
        ctx.onCleanup(cleanup)

        // Re-provide on change. provide() updates the existing signal,
        // so consumers that read this value re-run.
        ctx.effect(() => provide(ctx.host, ThemeToken, theme()))

        ctx.on(ctx.refs.toggle, 'click', () => {
            theme(theme() === 'light' ? 'dark' : 'light')
        })
    })

// Consumer: reads the nearest provider's theme, reactively.
define('themed-card')
    .withContexts(() => ({
        theme: ThemeToken,
    }))
    .setup(ctx => {
        // Reading ctx.contexts.theme inside an effect subscribes to it,
        // so this re-runs whenever the provider toggles the value.
        ctx.effect(() => {
            ctx.host.dataset.theme = ctx.contexts.theme
        })
    })
```

```html
<theme-provider>
    <button>Toggle theme</button>
    <themed-card>Card A</themed-card>
    <themed-card>Card B</themed-card>
</theme-provider>
```

Both cards resolve to the same nearest `<theme-provider>`, so one click
updates both. `resolveContextSignal(element, token)` is the low-level lookup
those reads use under the hood; reach for it only when you need the provider
signal imperatively.

---

### `microtags/render`

A keyed reconciler for rendering lists and single items from a
`<template>`, with no virtual DOM and no diffing library.

Microtags' state is reactive. When a signal changes, you want the DOM to follow.
A way to do that for a list is to rebuild the markup on every change,
e.g. `container.innerHTML = items.map(toHTML).join('')`.

But rebuilding the markup on every change
**throws away and recreates every node on every update**, losing any DOM
state, like focus, text selection, scroll position, and the internal state of
elements like `<video>`, `<details>`, and `<iframe>`. It also re-parses HTML on
every pass, which creates a vector for string-concatenation XSS.

**This library exports a `renderList` and a `render` function**.
They diff against the live DOM. See
[example/render-demo.ts](./example/render-demo.ts) for a working example.

#### `renderList`

Each item is matched to an existing element by its `key` attribute, so nodes
are reused across renders rather than being recreated. Nodes whose keys
disappear from the data are removed, surviving nodes are moved into place
with the fewest DOM operations, and your `update` callback runs only for
items whose value actually changed (compared by identity). Focus state and other
DOM state survives a re-render, and changing one row touches only that row.

```ts
function renderList<T, E extends Element = Element> (
    container:Element,
    template:HTMLTemplateElement,
    options:{
        data:readonly T[];
        key:(item:T, index:number) => string|number;
        update:(el:E, item:T) => void;
    }
):void
```

##### `renderList` Example

The markup is the list container plus a `<template>` for one row:

```html
<ul></ul>
<template>
    <li>
        <span class="name"></span>
    </li>
</template>
```

Call `renderList` from inside an effect so it re-runs whenever the data
signal changes:

```ts
ctx.effect(() => {
    renderList(ctx.refs.list, ctx.refs.row, {
        data: items(),
        key: item => item.id,
        update: (el, item) => {
            el.querySelector('.name')!.textContent = item.name
        },
    })
})
```

#### `render`

`render` is the same machinery for a single item. It keys on the template, so
repeated calls update the same element in place instead of replacing it.

```ts
function render<T, E extends Element = Element> (
    container:Element,
    template:HTMLTemplateElement,
    options?:{
        data?:T;
        update?:(el:E, item:T) => void;
    }
):void
```

##### `render` Example

The markup is a container plus a single-item `<template>`:

```html
<div class="item"></div>
<template>
    <div>
        <span></span>
    </div>
</template>
```

```ts
import { render } from 'microtags/render'

// Render a single item into the container from the <template>.
render(container, template, {
    data: item,
    update: (el, item) => {
        el.querySelector('span')!.textContent = item.name
    },
})
```

For a runnable version, see `example/render-demo.ts`. It keeps an editable
`<input>` in every row and a single item panel rendered with `render`, then
re-renders on a timer and reorders on demand to show that focus, caret, and
typed text survive: keyed nodes are reused and at most moved, never rebuilt.

---

### `microtags/util`

Helpers for reading raw attribute strings and running cleanup
functions. `withProps` uses these internally to coerce attribute values.
They are exported for when you need to read an attribute outside of the
prop layer.

```ts
import {
    coerceNumber,
    coerceString,
    coerceBoolean,
    coerceJson,
    runCleanups,
} from 'microtags/util'
```

#### Coercion

Each coercion helper takes the raw `getAttribute` result -- a `string` or
`null` -- and returns a typed value. None of them throw.

```ts
function coerceNumber (raw:string | null):number
function coerceString (raw:string | null):string
function coerceBoolean (raw:string | null):boolean
function coerceJson<T = unknown> (raw:string | null):T | undefined
```

- `coerceNumber` -- `Number(raw)`, or `NaN` when the attribute is absent
  or cannot be parsed.
- `coerceString` -- the value as-is; a missing attribute (`null`) becomes
  the empty string `''`.
- `coerceBoolean` -- presence-based, matching the HTML boolean-attribute
  convention: absent (`null`) is `false`, present is `true`, including the
  empty string from `disabled=""`.
- `coerceJson` -- `JSON.parse(raw)`, or `undefined` when the attribute is
  absent or not valid JSON. Pass a type parameter to annotate the result.

#### `runCleanups`

Runs every function in the array, even if some throw. After all have run
it re-throws the first error encountered, so one failing teardown cannot
skip the rest. A `Cleanup` is a no-argument teardown function, `() => void`.

```ts
function runCleanups (fns:Cleanup[]):void
```

#### `toAttributes`

Transform an object into an HTML attributes string. The object should be
like `{ attributeName: value }`. Handles boolean values by adding a string, eg
`{ disabled: true }` = `<button disabled>`. Arrays are converted to a list in
quotes, eg `{ class: ['abc', 'def'] }` = `<div class="abc def">`

```ts
type Attrs = Record<
    string,
    undefined|null|string|number|boolean|(string|number)[]
>

/**
 * Transform an object into an HTML attributes string. The object should be
 * like `{ attributeName: value }`.
 *
 * @param {Attrs} attrs An object for the attributes.
 * @returns {string} A string suitable for use as HTML attributes.
 */
function toAttributes (attrs:Attrs):string
```

---

## Divergence from `nanotags`

### Reactivity primitive

`nanotags` uses `nanostores` atoms; `microtags` uses `alien-signals`.

| nanotags (nanostores) | microtags (alien-signals) |
|---|---|
| `$count = atom(0)` | `const count = signal(0)` |
| `$count.get()` | `count()` |
| `$count.set(1)` | `count(1)` |
| `ctx.props.$count` (store) | `ctx.props.count` (callable signal) |

Props declared with `withProps` are signals. There is no `$` prefix convention;
all prop names are plain identifiers.

### Effects + Subscriptions

In `nanotags`, `ctx.effect` takes the store(s) to watch
explicitly and hands the value to the callback:

```ts
// nanotags
ctx.effect(ctx.props.$count, count => {
    ctx.refs.display.textContent = String(count)
})
```

In `microtags`, `ctx.effect` takes a zero-argument function and tracks whichever
signals are read inside it (the `alien-signals` model):

```ts
// microtags
ctx.effect(() => {
    ctx.refs.display.textContent = String(ctx.props.count())
})
```

The read operation in `ctx.effect` subscribes to the signal, and runs on
any signal change. A read inside an effect that you do *not* want to track has
to go through [`peek` or `untracked`](#peek-and-untracked).
In nanotags `.get()` never subscribes, so there is no equivalent.

### Refs: `r.all` instead of `r.many`

The multi-element ref is `r.all()` in `microtags` and `r.many()` in `nanotags`.
The empty-match behavior also differs: `r.all()` returns an empty array when
nothing matches, whereas nanotags' `r.many()` throws. `r.one()` throws on a
missing element in both.


### Context API

The context API is shaped differently. See
[`microtags/context`](#microtagscontext).

| nanotags | microtags |
|---|---|
| `createContext<T>('name')` | `createContext<T>()`, no name |
| `token.provide(ctx, value)` | `provide(ctx.host, token, value)`, standalone, returns a cleanup |
| `withContexts({ theme: token })` | `withContexts(() => ({ theme: token }))`, a function |
| `token.consume(ctx, cb)` | `ctx.consume(token)`, returns value-or-`undefined` |

### Props

| nanotags | microtags |
|---|---|
| `p.json(schema, default)`, hydrated from a `<script type="application/json">` tag, not an attribute | `p.json<T>()`, type-only, parsed from the observed attribute |
| custom schema passed directly as the prop def | wrap it in `p.schema(validator)` |
| property-only via `{ schema, attribute: false }` | `p.prop(initial)` |
| nullable fallback `p.string(null)` | no null-fallback argument; a failed `p.schema` falls back to `undefined` |

### Not ported

These nanotags APIs have no microtags equivalent:

- `ctx.getElement` / `ctx.getElements` -- declare refs with `withRefs`, or
  call `ctx.host.querySelector` directly.
- The `setup` mixin return value -- `setup` returns `void`; it does not
  assign members back onto the element.
- The `define(name, setupFn)` two-argument shorthand -- always use the
  builder chain ending in `.setup()`.

### Additions / New Features

* Serverside-compatible API -- see [serverside example](#serverside-example) --
  we expose `.TAG` and `.refs` on your component, which can be imported in a
  server environment.
