# Preact adapter, render parts, and a release of the hydration work

**Status:** ready-for-agent

**Date:** 2026-11-08

Source: a design session in `../components`
(`@substrate-system/components`), which is moving every component it
ships onto microtags. Its first component is `number-input`. That repo
needs each component to render to an HTML string on the server, to
hydrate in the browser with no render code shipped, and to work inside a
Preact app both when Preact renders on the client and when Preact
hydrates a server-rendered page. This spec is the microtags half of that
work. It is written against `wip-adding-hono-to-hydration-example` at
18e63ab, into which every earlier ticket series (`unidirectional-
hydration`, `hono-html-scaffold`, `hydration-dx-fixes`,
`millitags-lessons`) is already merged.

No ADR is superseded. The adapter's contract gets a new ADR (ADR-010).

## Problem Statement

A Preact author who puts a microtags component in their tree has no way
to make it survive server rendering and hydration.

When Preact renders the bare host tag on the server, the output is an
empty host, `<number-input min="1"></number-input>`, because Preact does
not know the component has markup of its own. The page arrives without
the component's input or buttons.

If the author fills the host with server markup some other way, Preact's
`hydrate` deletes it. Preact 10 collects every existing child of an
element it hydrates and removes each one it has no vnode for. The
component's own markup has no vnode, so it is removed. The only branch
that skips this is an element whose vnode carries
`dangerouslySetInnerHTML`.

The author also cannot get the pieces they would need to build this
themselves. A component's `render` static returns one finished string,
host tag included, so there is no way to ask for the inner markup and
the host attributes separately.

Finally, none of the server render, build-time stripping, Vite plugin,
browser templater or render-support work is published. npm has 0.0.14
from 2026-09-23, which exports only `.`, `./min`, `./util`, `./render`
and `./context`. A downstream package cannot depend on any of it.

## Solution

A component can return its server render as parts: the tag, the
serialized host attributes, and the inner HTML. The existing `render`
static is rebuilt on top of the parts, so its output does not change.

A new entry, `microtags/preact`, exports a `toPreact` factory. It takes
a microtags element class and returns a Preact component that renders
the host tag. Preact owns the host and the element owns the host's
children. On the server, the adapter fills the host with the component's
inner HTML from the render parts, so `renderToString` produces the same
markup as the component's own `render` static. In the browser, the
adapter gives the host a fixed, empty `dangerouslySetInnerHTML`. During
`hydrate`, Preact leaves that element's children alone. Because the
value never changes, later renders never write `innerHTML` either. On a
client-only mount, Preact empties the host once and the element renders
itself when it connects.

The browser build of the adapter contains no render code. It is selected
by a `browser` export condition, the same way `microtags/htm` already
splits.

Then the branch is released, so `../components` can depend on a
published version.

## User Stories

1. As a Preact app author, I want to write
   `<NumberInput min={1} value={5} />` in my tree and get the
   component's full markup from `renderToString`, so that the
   server-rendered page shows a working control before any script runs.
2. As a Preact app author, I want `hydrate` to keep the component's
   server-rendered nodes, so that the user does not see the control
   flash, and a value they typed before scripts loaded is not lost.
3. As a Preact app author with no server rendering, I want the same
   adapter to work under plain `render`, so that one import serves both
   kinds of app.
4. As a Preact app author, I want a prop change in my tree to reach the
   element without Preact touching the element's children, so that the
   component keeps its own DOM and state across re-renders.
5. As a Preact app author, I want typed callback props such as
   `onChange` that receive the component's events, so that I do not
   have to write `addEventListener` in a ref.
6. As a Preact app author, I want the adapter's browser bundle to carry
   no render code, so that hydrating a prerendered page costs only the
   component's behavior.
7. As a component library author, I want a component's server render
   as tag, attributes and inner HTML, so that I can embed it in any
   host renderer, not only Preact.
8. As a component library author, I want a clear error when an adapter
   is asked to server render a component whose render link was
   stripped, so that a wrong import path fails at build or request
   time, not as an empty host in production.
9. As a downstream package author, I want this work published under a
   new version, so that I can depend on it from npm.

## Implementation Decisions

**Render parts.** A component class with a render link gains a second
static next to `render`. It takes the same arguments (props, plus
options `children` and `attrs`) and returns an object with three
fields: `tag`, the host tag name; `attrs`, an ordered record from
attribute name to serialized string value, holding the declared props
first and then the extra `attrs`, filtered by the same name check; and
`html`, the inner HTML string. The name is `renderParts`. A component
without a render link has neither static, as today.

**Render support stays the only place that serializes.** The
serializer, escaping and attribute-name filter stay in the render
support module. Render support registers a parts function next to
`renderHost` under a new registry symbol, `microtags.renderParts`,
because ADR-009 says changing the render record contract needs a new key,
and this keeps any copy of core working with any copy of render support.
`renderHost` is rewritten to assemble its string from the parts. Its
output must stay byte-identical.

**`microtags/preact` entry.** It has a new subpath export with two
builds:
- a `browser` condition build that never imports render support;
- a default build for Node and SSR that imports render support, as the
  vite transform already does for kept render links (ADR-009).

`preact` becomes an optional peer dependency, like `typescript` today.
Core and every other entry must never import `preact`.

**`toPreact(El, options?)`.** It returns a Preact function component.
- Its props are the element's declared props, typed from the class.
- It also takes callback props declared in `options.events`, a map from
  callback prop name to DOM event name, e.g. `onChange` ->
  `number-input:change`.
- Any other `class`, `id`, `aria-*` and `data-*` props pass through to
  the host.
- It does not accept Preact children. Passing them is a type error, and
  the adapter throws in development. Slotting vnode children into
  element-owned markup is out of scope.

**Server behavior.** On the server, the adapter returns a host vnode
whose attributes come from `renderParts(props)`. The empty-string
serialization of a true boolean becomes `true`, so Preact emits a bare
attribute. The inner HTML comes from the parts' `html`, through
`dangerouslySetInnerHTML`. If the class has no `renderParts`, because
its render link was stripped or never written, the adapter throws an
error that names the tag and says to import the variant that keeps its
render link on the server.

**Browser behavior.** In the browser, the adapter returns a host vnode
with:
- the declared props as vnode props, so Preact assigns them as
  properties: the host defines an accessor for each declared prop, and
  Preact assigns any name that exists `in` the element;
- one `on<event-name>` function prop per mapped event, which Preact
  attaches with the event name's case preserved, and attaches even while
  hydrating;
- a `dangerouslySetInnerHTML` whose `__html` is the empty string, kept
  in one shared constant.

The behavior relies on two branches of Preact's element diff, verified
in Preact 10.29.7. While hydrating, Preact does not write `innerHTML`
and does not remove the element's existing children. Outside hydration,
it writes `innerHTML` only when the new `__html` differs from the old
one. Because the value never changes, it is written at most once, on
the first non-hydrating render.

**Props before definition.** If the element is not yet defined when
Preact first assigns a prop, the property does not exist on the element
yet, so Preact sets an attribute instead. The adapter does not work
around this. A component's declared props already read their attribute
at connect time. The ADR records this as a known edge.

**ADR-010.** Record the ownership split: Preact owns the host and its
attributes, and the element owns the host's children. Record the fixed
empty `__html` as the mechanism, and the rejected alternatives: a bare
tag; a global `options.vnode` hook that injects inner HTML into every
microtags tag; per-call `__html` that changes with props, which Preact
would write over live DOM.

**Idempotent registration.** A builder's `setup` registers the element
only when the tag is not already registered. It does not throw when the
tag is taken, and the first registration wins. Without this, a
downstream package that ships a full and a render-stripped build of the
same component throws "already defined" whenever both reach one page.
(Added 2026-11-08 by the `../components` number-input spec. That repo's
ADR-002 requires it.)

**Release.** Bump to 0.1.0, because the public surface grows
substantially and some 0.0.14 behavior changed on this branch. Update
CHANGELOG and the README size table through the existing `version`
script. Add a README section for `microtags/preact`. Cutting the release
and publishing are human steps.

## Testing Decisions

Good tests here exercise only public surfaces: a component class's
statics, the `microtags/preact` export driven through Preact's own
`renderToString`, `render` and `hydrate`, and the built bundles. They do
not inspect vnode internals or adapter locals, and they do not assert on
CSS.

**Seam 1: render parts, Node with no DOM.** Extend the SSR suite that
`npm run test:ssr` runs. For a component with props of every kind, plus
extra attrs and children:
- assembling `renderParts` output into a host string equals `render`
  output, byte for byte;
- `attrs` contains no prop-only or null props, and no names that fail
  the attribute check;
- a class whose render link was stripped has no `renderParts`.

Prior art: the existing render static tests in that suite, and the
parity tests in the server/browser parity suite.

**Seam 2: adapter on the server, Node with no DOM.** Run in a new or
existing Node suite with `preact` and `preact-render-to-string` as dev
dependencies.
- Rendering the adapter with given props through `renderToString` gives
  the same parsed DOM as the component's `render` static: same tag, same
  attribute set, same inner markup. Compare parsed equivalence, not
  bytes, because Preact orders and quotes attributes its own way.
- A stripped class throws an error that names the tag.

**Seam 3: adapter in the browser.** Extend the browser suite (`npm
test`).
- Hydrate: put the server string for the component in a container, keep
  a reference to one of the component's inner nodes, and call Preact's
  `hydrate` with the adapter. The same node is still connected
  afterwards.
- After hydrate, re-render with a changed prop. The inner node is still
  the same node, and the element's property reflects the new value.
- A value typed into an inner input before hydrate survives.
- Client-only: with the full variant defined, Preact's `render` of the
  adapter produces the component's markup, and a later re-render does
  not replace it.
- Events: a mapped callback prop is called when the component emits the
  mapped event, both after hydrate and after a client-only render.

Prior art: the adoption and form-control tests from the
`millitags-lessons` 06 and 07 tickets in the browser suite.

**Seam 4: bundles.** Add a size-limit entry for the browser build of
`microtags/preact`. Add a check that the built browser adapter contains
no render-support code and no `preact-render-to-string`, and that core
contains no `preact` import, using the same built-asset isolation
approach as `millitags-lessons` ticket 09. Add every new suite to
`npm run gate`.

## Out of Scope

- Preact children passed into the adapter and slotted into element-owned
  markup.
- React and other host frameworks. The render parts make them possible,
  but only Preact gets an adapter here.
- A global vnode hook or any auto-registration of adapters.
- Changes to the stripping transform, the Vite plugin, or the `--keep`
  semantics. `../components` builds its full and hydrate-only variants
  with the existing `microbuild --keep`.
- Publishing to npm. That is a human step after review.

## Further Notes

- The consumer is `../components`, where `number-input` will be the
  first component. It will re-export `toPreact(NumberInput, ...)` as a
  typed `number-input/preact` entry, and develop against
  `file:../microtags` until this release is published.
- Two terms from this repo's CONTEXT.md apply, and the spec uses them
  with those meanings. **Hydration** is the intent: attaching behavior to
  existing markup. **Adopt** is the mechanism. The adapter's job is to
  keep Preact from undoing hydration. It does not adopt anything itself.
- Verify `microtags/htm` and `microtags/preact` under Cloudflare
  Workers. Wrangler's bundler is understood to resolve the `workerd`,
  `worker` and `browser` conditions. If so, a Worker doing server
  rendering resolves the browser build of any export that only checks
  `browser`. If that is confirmed, add a `workerd` condition ahead of
  `browser` that points at the server build.
- If a later Preact version changes either of the two diff branches the
  browser behavior depends on, the seam 3 tests are what catch it. Pin
  the Preact dev dependency so a change shows up as a deliberate bump.
