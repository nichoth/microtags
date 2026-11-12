# microtags

A helper for building custom elements that hydrate server-rendered HTML.
The browser downloads behaviour only; markup is authored once and rendered
on the server.

## Language

### Defining a component

**Component**:
A custom element defined through the builder chain. It carries behaviour
and, when it has a render link, its own markup.
_Avoid_: widget, element (ambiguous with the host instance)

**Tag name**:
The custom element name a component is registered under, such as
`my-counter`. Exposed on the class as `TAG`.
_Avoid_: element name, selector

**Builder chain**:
The sequence of calls that defines a component, starting at `define` and
ending at `setup`.
_Avoid_: pipeline, config

**Link**:
One call in the builder chain: `withProps`, `withRefs`, `withContexts`,
or `render`. `setup` is the terminal link.
_Avoid_: step, method (in prose)

**Prop**:
A named input declared with `withProps`. Inside `setup` it is a signal.
An attribute-backed prop is read from the host's HTML attribute of the same
name; a property-only prop is set from JavaScript only. Every prop also has
a property accessor on the host: assigning a plain value writes the prop,
and assigning a signal makes the prop read through to that signal
(`bindProp` does this with the signal's type checked). Once a
signal is assigned, the attribute is no longer updated and does not
reflect the current value. A bound prop is read-only inside the
component: writing it from `setup` throws, so the component emits an
event instead.
_Avoid_: attribute (that is the HTML side of a prop), input, option

**Coercer**:
A function that turns a raw attribute string, or its absence, into a typed
prop value. The four builtins are `number`, `string`, `boolean`, `json`.
_Avoid_: parser, validator

**Schema prop**:
A prop validated by a Standard Schema object rather than a builtin coercer.
A failed validation yields `undefined`.
_Avoid_: validated prop, custom prop

**Ref**:
A child element the component declares with `withRefs` and resolves when
the host connects, after an empty host with a kept render link is
rendered. By default a ref is found by its `data-ref` attribute.
_Avoid_: query, element ref, handle

**Statics**:
The values exposed on a component's class for use outside the browser:
`TAG`, `refs`, `render`, `renderParts`, and `props`.
_Avoid_: metadata, class properties

### Running a component

**Host**:
The custom element instance a component's behaviour is attached to. Its
children are light DOM, never a shadow root.
_Avoid_: root, wrapper, container

**Setup**:
The function run once per host when it connects, after required provided
contexts are available, an empty host with a kept render link is
rendered, and refs resolve. Its cleanups run a microtask
after the host disconnects, and only if it is still disconnected, so a
host moved within one tick keeps its setup and state.
_Avoid_: init, mount, constructor

**Setup context**:
The object handed to `setup`, carrying the host, prop signals, resolved
refs, provided context values, and lifecycle helpers.
_Avoid_: bare "context", ctx (in prose)

**Provided context**:
A value published by an ancestor host and read by descendants that opt in
with `withContexts` or `consume`. Reactive: consumers re-run when the
provider updates.
_Avoid_: bare "context", store, global

**Hydration**:
Attaching behaviour to markup that already exists in the document. At the
component level this happens when the class is registered; at the page
level the browser rebuilds the serialized state and mounts the same page
over the server-rendered DOM, adopting it.
_Avoid_: mounting, rendering, upgrading (the browser's term for the
mechanism, not the intent)

### Rendering markup

**Render function**:
The author-supplied function given to the `render` link. It returns the
host's inner HTML as a string or markup; the library wraps it in the host tag.
_Avoid_: template, view

**Render context**:
The object handed to the render function: plain prop values, the ref name
map, the tag name, and caller-supplied children and attrs. Distinct from
the setup context and from provided context.
_Avoid_: bare "context", props (it is more than props)

**Host tag**:
The opening and closing markup of the host, with its serialized
attributes, emitted around the render function's output.
_Avoid_: wrapper, outer HTML

**Render parts**:
The same server render as the `render` static, split into the host tag
name, the serialized (unescaped) host attributes, and the inner HTML.
Returned by the `renderParts` static so another renderer can build the
host tag itself.
_Avoid_: fragments, pieces

**Markup**:
The opaque value `html`, `h`, and `raw` return (`Markup`). On the server
`String(m)` yields the HTML; in the browser it also describes the nodes
mount creates or adopts.
_Avoid_: template (that is the HTML element), HTML string

**Reactive region**:
A signal or function in a child-position hole. The server evaluates it
once and wraps its output in `<!--[-->` and `<!--]-->` comment markers;
the browser re-evaluates it and morphs the nodes between the markers,
matching children by `key`, else by position and tag name. Children
passed to a component are not a region: they open with their own
`<!--[c-->` marker (closed by `<!--]-->`), so the browser can tell them
from regions in the component's own render.
_Avoid_: block, slot, island

**Mount**:
The browser templater's `mount(container, markup)`. It adopts the
container's children when there are any, otherwise creates the nodes, and
returns a dispose function that stops effects and removes listeners.
_Avoid_: render (that is the link), hydrate (that is the intent)

**Adopt**:
Walking markup against DOM that already exists and binding props,
attributes, listeners, and regions to it without creating nodes. It never
descends into a host's own markup, only into its marked children range.
_Avoid_: reuse, claim

**Server render**:
Producing a component's or page's markup as a string outside the browser.
"SSR" is an accepted abbreviation.
_Avoid_: pre-render, static render

**Client-rendered component**:
A component whose render link is kept in the browser bundle so it can
produce its own markup after page load. A page asks for the client
render by inserting an empty host; core renders it before refs resolve.
_Avoid_: dynamic component, lazy component

**Templater**:
The `html` tagged template that composes a page from plain tags and
components, escaping interpolated strings and expanding nested components.
It returns markup. The same import resolves to a server build and a
browser build; the browser build also binds signals, listeners, and
reactive regions, and exports mount.
_Avoid_: template engine, template (that is the HTML element below)

**Template**:
The native `<template>` HTML element that `render` and `renderList` from
the DOM helpers clone rows from. Unrelated to the templater.
_Avoid_: template string, partial

**Trusted string**:
Content the templater inserts without escaping. Markup (the output of the
templater and of `raw`) and the output of a render function are trusted;
every other interpolated string is escaped. Nesting markup never
double-escapes it.
_Avoid_: safe string, raw HTML (that is the function name)

### Building for the client

**Strip**:
Removing a component's render link from client code at build time so the
browser does not download markup.
_Avoid_: tree-shake (that is the bundler's own dead-code pass), prune

**Keep**:
An opt-out from stripping, declared in source with `client: true` or at
build time by tag name.
_Avoid_: preserve, whitelist

**Cascade**:
After stripping, removing the imports and top-level declarations that only
the stripped code used, repeated until nothing more is removed.
_Avoid_: dead-code elimination, tree-shake
