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

**Size**: 3.41 kB with all dependencies, minified and brotlied

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
  * [define](#define)
  * [withContexts](#withcontexts)
  * [setup and ctx](#setup-and-ctx)
    + [peek and untracked](#peek-and-untracked)
- [Subpaths](#subpaths)
  * [microtags/context](#microtagscontext)
  * [microtags/render](#microtagsrender)
- [Divergence from nanotags](#divergence-from-nanotags)

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

Inside `setup()`, every prop is a callable signal:

```ts
ctx.props.count()      // read
ctx.props.count(42)    // write
```


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
    button: r.one(),   // resolves [data-ref="button"] — throws if missing
    items:  r.all(),   // resolves all [data-ref="items"] — empty array if none
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


### define

```ts
import { define } from 'microtags'

define(tagName: string): ComponentBuilder
```

Returns a fluent builder. Call `.setup()` to register the custom element.
All builder methods are chainable and fully type-inferred.

### withContexts

```ts
import { createContext } from 'microtags/context'

const ThemeToken = createContext<string>()

define('my-child')
    .withContexts(() => ({
        theme: ThemeToken,
    }))
    .setup(ctx => {
        ctx.effect(() => {
            console.log('theme is', ctx.contexts.theme)
        })
    })
```

`setup()` is deferred until all required contexts resolve. See
[microtags/context](#microtagscontext) for the provider API.

### setup and ctx

```ts
.setup(ctx => {
    // ctx.host       — the HTMLElement itself
    // ctx.props      — callable signals for each declared prop
    // ctx.refs       — resolved DOM refs
    // ctx.contexts   — consumed context values (reactive)

    // Run a tracked effect; auto-disposed on disconnect.
    ctx.effect(() => {
        document.title = ctx.props.label()
    })

    // Bind a DOM property to a signal expression; auto-cleaned.
    ctx.bind(() => String(ctx.props.count()), el, { prop: 'textContent' })

    // Add an event listener; auto-removed on disconnect.
    ctx.on(el, 'click', handler)

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

## Subpaths

### microtags/context

Cross-component context backed by alien-signals.

```ts
import { createContext, provide, resolveContextSignal } from 'microtags/context'

const ThemeToken = createContext<string>()

// In a provider component's setup():
const cleanup = provide(ctx.host, ThemeToken, 'dark')
ctx.onCleanup(cleanup)

// In a consumer component via withContexts:
ctx.contexts.theme   // 'dark' (reactive — re-runs effects when value changes)
```

### microtags/render

DOM diffing helpers for rendering lists and single items without a virtual DOM.

```ts
import { render, renderList } from 'microtags/render'

// Render a single item into a container from a <template>.
render(container, template, {
    data: item,
    update: (el, item) => { el.querySelector('span')!.textContent = item.name },
})

// Render a keyed list with minimal DOM mutations.
renderList(container, template, {
    data: items,
    key: item => item.id,
    update: (el, item) => { /* update el from item */ },
})
```

## Divergence from nanotags

| nanotags (nanostores) | microtags (alien-signals) |
|---|---|
| `$count = atom(0)` | `const count = signal(0)` |
| `$count.get()` | `count()` |
| `$count.set(1)` | `count(1)` |
| `ctx.props.$count` (store) | `ctx.props.count` (callable signal) |

Props declared with `withProps` are native alien-signals callable signals.
There is no `$` prefix convention — all prop names are plain identifiers.

```
/ed3d-plan-and-execute:execute-implementation-plan /Users/nick/code/_microtags/docs/implementation-plans/2026-06-28-zod-validation-example/ /Users/nick/code/_microtags/
```
