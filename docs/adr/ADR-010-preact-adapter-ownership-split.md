# ADR-010: Preact owns the host, the element owns its children

**Date:** 2026-11-08

**Status:** Accepted

**Related:** [ADR-004][adr-004] (client size), [ADR-005][adr-005] and
[ADR-009][adr-009] (render links and render support)

## Context

`../components` (`@substrate-system/components`) is moving its
components onto microtags, and they have to work inside Preact apps.
That covers a client-only Preact render and a Preact `hydrate` of a
server-rendered page. A microtags element placed in a Preact tree
fails in both server cases.

On the server, Preact's `renderToString` emits an empty host, such as
`<number-input min="1"></number-input>`. Preact only knows the host
tag. It does not know that the component has markup of its own, so
the page arrives without the component's input or buttons.

In the browser, Preact 10's `hydrate` collects every existing child of
an element it hydrates and removes each child it has no vnode for. The
component's own markup has no vnode, so even if the server sent it,
`hydrate` deletes it. The only exception is an element whose vnode has
`dangerouslySetInnerHTML`. Preact leaves that element's children alone.

The terms below have their `CONTEXT.md` meanings. **Hydration** is the
intent: attaching behaviour to markup that already exists in the
document. **Adopt** is the mechanism: walking markup against existing
DOM and binding to it without creating nodes. A microtags element
hydrates itself when its class is registered. The adapter's job is to
keep Preact from undoing that hydration. It does not adopt anything
itself.

## Decision

Add a `microtags/preact` entry that exports `toPreact(El, options?)`.
It returns a Preact component that renders the element's host tag.
Ownership is split at the host:

- Preact owns the host tag and its attributes.
- The element owns the host's children.

**On the server**, the adapter builds the host vnode from the
component's render parts (the `renderParts` static, ADR-009's render
support behind a new registry key). The attributes come from the
parts' `attrs`, and the parts' `html` goes in through
`dangerouslySetInnerHTML`. `renderToString` then produces the same
markup as the component's own `render` static. A class whose render
link was stripped has no `renderParts`, so the adapter throws an error
that names the tag.

**In the browser**, the adapter gives each host one
`dangerouslySetInnerHTML` object, kept for the life of the Preact
component instance, whose `__html` is fixed once the host has been
committed. It also passes the declared props as vnode props, which
Preact assigns as properties because the host defines an accessor for
each one. While hydrating, Preact skips every non-function prop, and
on later renders it skips a value equal to the hydrated one, so a
value the server attributes cannot carry (a prop-only prop, an object)
would never reach the element. The host's ref, a fresh function each
render so Preact calls it on every commit, assigns each non-function
declared prop whose property differs from the passed value. Mapped
events are passed as `on<event-name>` props. The
mechanism depends on two branches of Preact's element diff:

1. While hydrating, Preact neither writes `innerHTML` nor removes the
   element's existing children, and does not read `__html`. The server
   markup stays and the element adopts it.
2. Outside hydration, Preact writes `innerHTML` only when the new
   `__html` differs from the old one. On a client-only mount, the
   first read of `__html` happens before the host is committed, so the
   adapter returns the inner HTML from the class's `renderParts`
   (empty when the class has no render link). Preact writes it before
   the element connects, so the element finds its markup and refs, as
   core never renders into an empty host. Once the host is committed
   (hydrated or mounted), `__html` never changes, so later renders
   never touch the children.

Both branches were verified in Preact 10.29.7. The `preact` dev
dependency is pinned, so a Preact change arrives as a deliberate bump,
and the browser tests (hydrate keeps inner nodes, re-render keeps
them, typed input survives) check it.

The browser build is selected by a `browser` export condition, as
`microtags/htm` already is, and never imports render support.

## Rejected alternatives

- **A bare host tag.** No adapter, just `<number-input>` in JSX. The
  server output is an empty host, and `hydrate` deletes whatever
  server children the host had. This is the problem itself.
- **A global `options.vnode` hook.** One hook that recognises every
  microtags tag and injects its inner HTML. It is implicit: a page
  changes behaviour depending on whether some module installed the
  hook. It is global, so it affects every Preact tree in the page,
  and it runs on every vnode, not only microtags hosts.
- **A per-call `__html` that changes with props.** Render the inner
  HTML from the current props on every render. When a prop changes,
  the new `__html` differs from the old, so Preact writes `innerHTML`
  over live DOM. That replaces the element's nodes and destroys their
  state: bindings, focus, and values the visitor typed.

## Trade-offs

- The approach depends on two internal branches of Preact's diff, not
  a documented contract. The pin and the browser tests turn a silent
  break into a failing bump.
- **Props before definition.** If the element is not yet defined when
  Preact first assigns a prop, the property does not exist on the
  element, so Preact sets an attribute instead. The adapter does not
  work around this. A component's declared props already read their
  attribute at connect time, so the value still arrives. This ADR
  records it as a known edge.

## Consequences

- No Preact children. The adapter does not accept them: passing them is
  a type error, and the adapter throws in development. Slotting vnodes
  into element-owned markup is out of scope.
- The browser build of `microtags/preact` carries no render code. It
  does not import render support, so with every render link stripped
  a client bundle stays as small as ADR-004 requires. A client-only
  mount calls the class's `renderParts`, so it needs the variant that
  keeps its render link, with render support registered (the build
  transform imports it for a kept render link).
- The browser adapter imports `preact/hooks` (`useRef`) to keep one
  `dangerouslySetInnerHTML` object per component instance.
- `preact` is an optional peer dependency, like `typescript`. Core and
  every entry other than `microtags/preact` never import it.
- Render support gains a second registered function, the parts
  function, under `Symbol.for('microtags.renderParts')`. ADR-009's
  render record contract is unchanged, so any copy of core keeps
  working with any copy of render support.
- `renderHost` now builds its string from the parts, whose `attrs` is a
  record, so a name appears once. When an extra attr has the same name
  as a declared prop that serializes, the host carries only the
  declared value: `render({ n: 1 }, { attrs: { n: '2' } })` gives
  `<x n="1">`, where 0.0.14 gave `<x n="1" n="2">`. An HTML parser
  keeps the first of a duplicate, so the parsed DOM is the same; only
  the bytes change. A declared prop that is unset, null or prop-only
  leaves the extra attr in place.

No ADR is superseded.

[adr-004]: ./ADR-004-client-bundle-size-outranks-ergonomics.md
[adr-005]: ./ADR-005-single-file-components-with-build-time-render-stripping.md
[adr-009]: ./ADR-009-server-render-support-through-render-link.md
