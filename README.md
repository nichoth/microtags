# microtags

[![tests](https://img.shields.io/github/actions/workflow/status/nichoth/microtags/nodejs.yml?style=flat-square)](https://github.com/nichoth/microtags/actions/workflows/nodejs.yml)
[![types](https://img.shields.io/npm/types/microtags?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![install size](https://flat.badgen.net/packagephobia/install/microtags?cache-control=no-cache)](https://packagephobia.com/result?p=microtags)
[![gzip size](https://img.shields.io/bundlephobia/minzip/microtags?style=flat-square)](https://bundlephobia.com/package/microtags)
[![license](https://img.shields.io/badge/license-Big_Time-blue?style=flat-square)](LICENSE)

Web component helper with reactive props, automatic cleanup, and
[no Shadow DOM](https://gomakethings.com/the-shadow-dom-is-an-antipattern/).
Reactive via [alien-signals](https://github.com/stackblitz/alien-signals).

**Size: <!-- size -->3.48 KB<!-- /size -->** with all dependencies, minified and brotlied

Inspired by [nanotags](https://nanotags.psdcoder.dev/). Reactive props use
**alien-signals** instead of nanostores atoms.

<details><summary><h2>Contents</h2></summary>

<!-- toc -->

- [Install](#install)
  * [Import map](#import-map)
  * [Pre-bundled](#pre-bundled)
- [Get Started](#get-started)
  * [1. Call `.define`](#1-call-define)
  * [2. Call the `.with*` Methods](#2-call-the-with-methods)
  * [3. Call `.setup`](#3-call-setup)
- [Full Example](#full-example)
- [Validation](#validation)
  * [Prop validation](#prop-validation)
    + [`p.schema` vs Standard Schema](#pschema-vs-standard-schema)
  * [Client-side validation](#client-side-validation)
- [Serverside Example](#serverside-example)
  * [`.TAG`](#tag)
- [API](#api)
  * [`define`](#define)
    + [`ComponentBuilder`](#componentbuilder)
  * [`builder.withProps`](#builderwithprops)
    + [`p.json`](#pjson)
    + [`p.schema`](#pschema)
  * [`builder.withRefs(fn)`](#builderwithrefsfn)
  * [`builder.withContexts`](#builderwithcontexts)
    + [`.withContexts` Example](#withcontexts-example)
  * [`builder.setup(ctx)`](#buildersetupctx)
    + [`ctx`](#ctx)
- [Missing refs](#missing-refs)
  * [Checking refs in tests](#checking-refs-in-tests)
- [Typed Events](#typed-events)
- [Templates](#templates)
- [Subpath Exports](#subpath-exports)
  * [`microtags/context`](#microtagscontext)
  * [`microtags/render`](#microtagsrender)
    + [`renderList`](#renderlist)
    + [`render`](#render)
  * [`microtags/util`](#microtagsutil)
    + [Coercion](#coercion)
    + [`runAll`](#runall)
    + [`toAttributes`](#toattributes)
- [Differences from `nanotags`](#differences-from-nanotags)
  * [Reactivity primitive](#reactivity-primitive)
  * [Effects + Subscriptions](#effects--subscriptions)
  * [Refs: `r.all` instead of `r.many`](#refs-rall-instead-of-rmany)
  * [Context API](#context-api)
  * [Props](#props)
  * [Not ported](#not-ported)
  * [Additions / New Features](#additions--new-features)

<!-- tocstop -->

</details>

## Install

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

This package exposes `microtags/min`, which is a single self-contained file
with `alien-signals` inlined.

```html
<script type="importmap">
{
    "imports": {
        "microtags": "https://cdn.jsdelivr.net/npm/microtags/dist/index.min.js"
    }
}
</script>
```

## Get Started

### 1. Call `.define`

```ts
import { define } from 'microtags'

const myCounter = define('my-counter')
```

---

### 2. Call the `.with*` Methods

Methods `withProps`, `withRefs`, and `withContexts` are optional and can appear
in any order. `.setup` ends the chain. It calls `customElements.define` under
the hood and returns a typed constructor.

```ts
myCounter
    .withProps(p => ({
        start: p.number(),  // the starting count (an attribute)
    }))
    .withRefs(r => ({  // keys in this object are the `data-ref` names in HTML
        display: r.one<HTMLDivElement>(),  // typed as HTMLDivElement,
        inc: r.one(),  // depends on a child in HTML with `data-ref="inc"`
        dec: r.one(),  // depends on a child in HTML with `data-ref="dec"`
        copy: r.one(),  // the <copy-btn> element, via `data-ref="copy"`
    }))
```

### 3. Call `.setup`

Method `.setup` takes a function that gets called with `context` object.

```ts
myCounter
    .setup(ctx => {
        const count = signal(ctx.props.start())
        // `ctx.refs` are expected to be HTML elements with a matching `data-ref`
        const display = ctx.refs.display

        // whenever `count` changes
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

        /**
         * Listen for clicks.
         */
        ctx.on(ctx.refs.inc, 'click', () => {
            count(count() + 1)
        })

        ctx.on(ctx.refs.dec, 'click', () => {
            count(count() - 1)
        })
    })
```

## Full Example

This example expects the full HTML to already be in the DOM.
Defining the components is about "hydrating" the page, or adding behavior.

If you want to client-side render the components, that is possible too.
You can update the DOM inside `.setup`.

>
> [!NOTE]  
> The server should know how to create the markup that components depend
> on here. See [the serverside example](#serverside-example).
>


```ts
import { define } from 'microtags'
import { signal } from 'alien-signals'

/**
 *  - attribute-backed prop (`start`)
 *  - data-ref elements -- each needs a data-ref attribute, eg data-ref="inc"
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

## Validation

There are two separate things people call "validation":

1. **Prop validation** checks the attributes passed into a component.
   Pass a [Standard Schema](https://standardschema.dev) (Zod, Valibot,
   ArkType) to [`p.schema`](#withprops); it coerces the attribute value
   and falls back to `undefined` when the value doesn't coerce.
2. **Form input validation** -- client-side validation -- checks live user input
   in a form, for example a value that changes on every keystroke.
   There is no dedicated API for this. Validate the schema directly
   inside `.setup()` and hold the result as a signal.

### Prop validation

Pass a [Standard Schema](https://standardschema.dev) validator to `p.schema`.
The validator runs against the raw attribute and its output becomes the
signal's value; anything it rejects falls back to `undefined`.

```ts
import { z } from 'zod'
import { define } from 'microtags'

// Any Standard Schema validator works (Zod, Valibot, ArkType). microtags
// only sees the shared `~standard` interface, so it has no validation
// library of its own and no dependency on the one you pick.
const Variant = z.enum(['info', 'success', 'warning', 'danger'])

define('status-badge')
    .withProps(p => ({
        // Validates the raw `variant` attribute. A value outside the
        // four options falls back to `undefined`.
        variant: p.schema(Variant),
    }))
    .setup(ctx => {
        ctx.effect(() => {
            const variant = ctx.props.variant() ?? 'info'
            ctx.host.className = `badge badge-${variant}`
        })
    })
```

```html
<status-badge variant="success">Saved</status-badge>

<!-- "purple" is not in the enum, so ctx.props.variant() is undefined -->
<status-badge variant="purple">Unknown</status-badge>
```

#### `p.schema` vs Standard Schema

[Standard Schema](https://standardschema.dev) is a small shared interface
that Zod, Valibot and ArkType all implement. `p.schema` validates through that
interface, so microtags ships no validator of its own.

A schema prop is attribute-backed and observed, exactly like `p.string()` or
`p.number()`: editing the attribute re-runs the validator and pushes the result
to `ctx.props`.

The validator's input is the raw attribute string, or `null` when the attribute
is absent. Because the input is always a string, schemas for non-string values
must coerce. Use `z.coerce.number()`, not `z.number()`:

```ts
.withProps(p => ({
    // "5" -> 5; "0" and the absent attribute both fall back to undefined
    quantity: p.schema(z.coerce.number().int().min(1)),
}))
```

**On success the signal holds the validator's output value**; on failure it
falls back to `undefined`. The inferred signal type is the schema's output,
so guard for the `undefined` case, or fold a default into the schema so it
never fails:


```ts
{
    // always 'info' | 'success' | 'warning' | 'danger', never undefined
    variant: p.schema(Variant.catch('info')),
}
```

Only synchronous schemas are supported; an async schema throws when the
attribute is validated.

-------------------------------------------------------

### Client-side validation

There is no special API here. Validate input inside `.setup`, 

See [example/subscribe-form.ts](./example/subscribe-form.ts).

```ts
// form input (client-side) validation
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
        const touched = signal<boolean>(false)

        // capture the live value (two-way; clears the field on reset)
        ctx.bind(value, ctx.refs.input)

        // only reveal errors after the first blur
        ctx.on(ctx.refs.input, 'blur', () => touched(true))

        // ctx.effect is alien-signals/effect with automatic/correct disposal
        ctx.effect(() => {
            // subscribe to `value` and `touched`
            const result = Email.safeParse(value())
            const message = (result.success ?
                '' :
                result.error.issues[0].message)
            const showError = touched() && !result.success

            ctx.refs.submit.disabled = !result.success
            ctx.refs.input.setAttribute('aria-invalid', String(showError))
            ctx.refs.error.textContent = showError ? message : ''
        })

        ctx.on(ctx.refs.form, 'submit', ev => {
            // subscribe to DOM events
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

The error stays hidden until the field is blurred once, then updates live,
and the submit button is disabled until valid. See `example/subscribe-form.ts`.


---------------------------------------------------------------


## Serverside Example

See [./example/ssr.ts](./example/ssr.ts).

### `.TAG`

Each tag name that you pass to `define` is exposed as a property `.TAG`
on the return value. It is possible to import your web components in Node,
even though Node does not have browser APIs.

The `data-ref` attribute is a fallback. It's used when you don't pass a
selector to `r.one()`. If you pass explicit CSS selectors to `withRefs`,
e.g. `{ copy: r.one('button') }`, then the HTML does not require a `data-ref`
attribute.


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

### `.refs`

Web components created with `microtags` have a property `.refs` that is an
object of the ref names you created the coponent with. Use it to create
`data-ref` attributes.

```ts
import { MyCounter } from '../example.js'

export function render () {
    return `
        <div
            data-ref="${MyCounter.refs.display}"
            role="status"
            class="count"
        >${START}</div>
    `
}
```

---------------------------------------------------------------------


## API

### `define`

```js
function define (tagName:string):ComponentBuilder
```

Function `define(tagName)` returns a [`ComponentBuilder`](#componentbuilder).


#### `ComponentBuilder`

The object returned by [`define`](#define). Includes methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `.TAG` | `string` | The tag name passed to `define`. See [`.TAG`](#tag). |
| `.withProps(fn)` | `ComponentBuilder` | Declare reactive attributes. See [Props](#props). |
| `.withRefs(fn)` | `ComponentBuilder` | Declare DOM refs resolved once the element connects. See [Refs](#refs-1). |
| `.withContexts(fn)` | `ComponentBuilder` | Consume context values published by an ancestor. See [`withContexts`](#withcontexts). |
| `.setup(fn)` | `MicrotagElementClass` | Registers the custom element and returns its class. See [`setup`](#setup) below. |

Methods `withProps`, `withRefs`, and `withContexts` each return a new builder,
so they chain in any order; `setup` ends the chain by registering the element.

---------------------------------------------------------

### `builder.withProps`

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

Inside `.setup()`, every prop is a callable signal:

```ts
ctx.props.count()      // read
ctx.props.count(42)    // write
```


#### `p.json`

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

#### `p.schema`

For input you want validated rather than only parsed, pass a Standard Schema
to [`p.schema`](#withprops) instead.


---------------------------------------------------------


### `builder.withRefs(fn)`

Takes a function that gets called with a helpful query selector, `r`.

Call `r.one()` / `r.all()` with no argument to match `[data-ref="<key>"]`,
where `key` is the key name you passed in. Or pass a CSS selector to query by
it instead. Queries are resolved relative to the host element, during
[the `connectedCallback`](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks).

All refs returned from this callback are typed as much as possible, and exposed
on the `context` object passed to the `.setup` function.


```ts
class ComponentBuilder {
    withRefs<R extends Record<string, RefDef>> (
        fn:(r:RefsDSL) => R
    ):ComponentBuilder<Props, R, CtxDefs>
}
```


Takes a function that gets called with a [`RefsDSL`](./src/builders.ts#L54)
object. It should return an object of child elements that you want to keep
references to.

The `data-ref` attribute is a fallback. It's used when you don't pass a
selector to `r.one()`. If you pass explicit CSS selectors to `withRefs`,
e.g. `{ copy: r.one('button') }`, then the HTML does not require a `data-ref`
attribute.


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


---------------------------------------------------------------------


### `builder.withContexts`

Context is for the case where a parent component defines some state, e.g. a
`theme`, and the top-level (application) knows nothing about the theme, but the
application *does* determine what children the parent renders
(the app passes in children), and the children need to know the theme.

```ts
class ComponentBuilder {
    withContexts<C extends Record<string, ContextToken<unknown>>> (
        fn:(c:ContextDSL) => C
    ):ComponentBuilder<Props, RefDefs, C>
}
```

#### `.withContexts` Example

```html
<!-- The application composes this markup. -->
<theme-provider>
    <some-child></some-child>
    <another-child></another-child>
</theme-provider>
```

In that case, there is no way for the "parent" component to pass the theme to
the children. The root level (application) doesn't know what the theme is.

Context gives us a way to model this. The context-provider
publishes the value, and any descendants opt in with
`withContexts`.

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
        const rmContext = provide(ctx.host, ThemeToken, 'dark')
        ctx.onCleanup(rmContext)
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
<theme-provider>
    <themed-card>Card content</themed-card>
</theme-provider>
```


---------------------------------------------------------


### `builder.setup(ctx)`

Registers the custom element via `customElements.define` and returns the
element class. The returned class exposes `.TAG` and `.refs` as static
members, for use in [serverside rendering](#serverside-example).

```ts
class ComponentBuilder {
    setup (
        fn:(ctx:SetupContext<
            Props,
            RefsMap<RefDefs>,
            ContextsMap<CtxDefs>
        >) => void
    ):MicrotagElementClass<RefDefs> {
}
```

The callback function runs once per element instance, and is called with the
following `context` object.


#### `ctx`

The argument passed to the callback given to `setup`.

```ts
ctx:SetupContext<Props, RefsMap<RefDefs>, ContextsMap<CtxDefs>>
```

##### `ctx` Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.peek(signal)` | `T` | Read a signal's current value without subscribing, even inside `ctx.effect`. |
| `.on(target, type, handler, options?)` | `void` | Add a DOM event listener, auto-removed on disconnect. |
| `.emit(event)` / `.emit(name, detail?, options?)` | `boolean` | Dispatch a pre-built `Event` as-is, or construct and dispatch a bubbling `CustomEvent` from a name. Returns `dispatchEvent`'s result: `false` if a cancelable event had `preventDefault()` called. |
| `.effect(fn)` | `void` | Run an alien-signals effect that auto-tracks the signals it reads. Auto-disposed on disconnect. |
| `.bind(signal, element, options?)` | `void` | Bind a signal to a DOM element property, auto-cleaned on disconnect. |
| `.onCleanup(fn)` | `void` | Register custom teardown to run on disconnect. |
| `.consume(token)` | `T \| undefined` | Read an optional context value published by an ancestor. See [`withContexts`](#withcontexts). |

See [Typed Events](#typed-events) for more about `.on` and `.emit`.

##### `ctx.bind`

The `.bind` method treats the signal as the source of truth. The element
property is set from the signal.
With no `options`, the control's element property and write-back event are
auto-detected from its type:

```ts
{
    bind<T> (
        source:Signal<T>,
        control:Element,
        opts?:BindOptions
    )
}
```

| Control | `prop` | write-back `event` |
|---------|--------|---------------------|
| `<input type="checkbox">` | `checked` | `change` |
| `<input type="number">` / `type="range"` | `valueAsNumber` | `input` |
| Other `<input>` types / `<textarea>` | `value` | `input` |
| Anything else, e.g. `<select>` | `value` | `change` |

Passing `options` overrides the auto-detected `prop`, and replaces the
write-back `event` -- omit `options.event` for a one-way binding. A read-only
getter (`() => T`) is also accepted as the `signal` argument, for binding a
derived value one-way (pass it with `options` and omit `event`).

```ts
// two-way, auto-detected (checkbox -> `checked` / `change`)
ctx.bind(checked, ctx.refs.toggle)

// one-way: push a derived value into a read-only display
ctx.bind(() => `${count()} items`, ctx.refs.label, { prop: 'textContent' })
```

---


## Missing refs

Any calls to `r.one` in `.withRefs` will throw if there is not a matching
child element.

```
Error: MY-COMPONENT: missing refs: button, save
```

The tag name is upper case (it comes from `host.tagName`), and the
message lists every required ref that was not found.

Call to `r.all()` are **never reported**. A missing match resolves to an
empty array, not an error.

This check happens right before the custom element runs your `.setup` function.

For a component with no contexts, refs are resolved at the moment the element
connects to the DOM. For a component that declares
[`withContexts`](#withcontexts), ref collection is deferred along
with `setup` until every required context resolves.


### Checking refs in tests

A missing `r.one` ref throws while the component connects. When the browser
runs a lifecycle callback (which is what `appendChild` triggers), it reports
the exception to the global `error` event rather than propagating it to the
caller, so a try / catch around `appendChild` sees nothing.

You need to listen for the global `error` event. When every
`data-ref` the component declares is present, nothing is reported.

```ts
import { test } from '@substrate-system/tapzero'
import './my-counter.js'  // the component from the example above

test('all refs resolve', t => {
    let err:Error|null = null
    const onError = (ev:ErrorEvent) => { err = ev.error }
    window.addEventListener('error', onError)

    const el = document.createElement('my-counter')
    el.innerHTML = `
        <div data-ref="display"></div>
        <button data-ref="dec">-</button>
        <button data-ref="inc">+</button>`
    document.body.appendChild(el)

    t.ok(err === null, 'no missing refs')

    window.removeEventListener('error', onError)
    document.body.removeChild(el)
})
```


## Typed Events

`TypedEvent<Target, Detail>` is a type-only helper that narrows
`CustomEvent` to a specific `target` and `detail`. Combine it with
`HTMLElementEventMap` augmentation for app-wide type-safe events.

```ts
import type { TypedEvent } from 'microtags'

type TabsChangedEvent = TypedEvent<InstanceType<typeof XTabs>, { index:number }>

declare global {
    interface HTMLElementEventMap {
        'tabs:changed':TabsChangedEvent
    }
}

// Emitting from setup:
ctx.emit('tabs:changed', { index: 2 })

// Listening, fully typed:
ctx.on(tabsEl, 'tabs:changed', ev => {
    ev.target   // the XTabs instance
    ev.detail   // { index:number }
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

```ts
import { render, renderList } from 'microtags/render'
```

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
    runAll,
    toAttributes
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

#### `runAll`

Runs every function in the array, even if some throw. After all have run
it re-throws the first error encountered, so one failing teardown cannot
skip the rest. A `Cleanup` is a no-argument teardown function, `() => void`.

```ts
function runAll (fns:Cleanup[]):void
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

## Differences from `nanotags`

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
- The `define(name, setupFn)` two-argument shorthand -- always use the
  builder chain ending in `.setup()`.

### Additions / New Features

* Serverside-compatible API -- see [serverside example](#serverside-example) --
  we expose `.TAG` and `.refs` on your component, which can be imported in a
  server environment.
