# Unidirectional state for `example-hydration`, with a client templater

**Status:** ready-for-agent

**Date:** 2026-10-04

Two phases in one repo. The library phase lands first and is recorded as
ADR-007 (client templater: signal props, reactive regions, mount). The
example phase consumes it and is recorded as ADR-008 (serialized server
state and unidirectional hydration). Neither supersedes an existing ADR.
ADR-005 gets a note that the templater's return type changes and that a
component created in the browser must be kept. ADR-006 gets a note about
the second scaffold marker and the root wrapper.

This relaxes ADR-004 (client bundle size outranks ergonomics) for the
templater subpath only: strict size limits are waived for this work by the
maintainer. The core entry still grows by one small feature (prop
accessors), and nothing in this spec is loaded by a consumer who does not
import the templater.

Vocabulary note: the glossary reserves **template** for the native
`<template>` element, so the templater's new return type is called
**markup** here (`Markup` as a type name), not `Template` as it was called
during planning.

## Problem Statement

The hydration example does not feel like a unidirectional app. The counter
component creates and owns its own count signal, seeded from a `start`
attribute, so application state is scattered across hosts and nothing
outside a component can read or change it. The server hard-codes the
values it renders, and the browser has no way to learn what state the
server rendered from. Page-level behaviour is written as manual DOM code:
query an element, add a listener, assign `innerHTML`.

An author coming from a React or Preact app expects one state object,
created in one place, passed down, changed only through named functions,
with the DOM following automatically. The example's own state module was
started for this but is unused, and its `Serialized` type is the identity
type, so it cannot describe plain data crossing from server to browser.

## Solution

One state object per request on the server and one per page load in the
browser, built by the same `State` function. The server creates state for
the route, renders the page from it, and writes the state into the
document as inert JSON. The browser reads that JSON, rebuilds the state,
and mounts the same page function over the server-rendered DOM.

To make that possible the templater becomes usable in the browser. The
same `html` import resolves to a browser build that accepts signals as
props, attaches event handlers, and marks reactive regions. A `mount`
function adopts the existing DOM on first load without recreating it, and
afterwards a state change updates exactly the parts of the DOM that depend
on it. Value changes flow through signals with no diffing; structural
changes (a conditional, a list) are reconciled by a keyed morph of the
affected region.

The result for an app author: change state through a `State` function, and
the DOM reflects it. No manual DOM manipulation in application code.
Components remain the one place allowed to touch their own refs, and
their render functions are still stripped from the browser bundle.

## User Stories

1. As an app author, I want to create all application state with one
   `State` function, so that state has a single source of truth.
2. As an app author, I want the server to build state for the requested
   route, so that the first render reflects the request.
3. As an app author, I want the server-rendered document to carry its
   state as serialized data, so that the browser starts from exactly what
   the server rendered.
4. As an app author, I want a `Serialized<T>` type from the library, so
   that the input to `State` is typed as plain values rather than signals.
5. As an app author, I want to pass a signal as a component prop in the
   templater, so that the host follows state without wiring code.
6. As an app author, I want to pass an event handler in the templater, so
   that I never call `addEventListener` in application code.
7. As an app author, I want a conditional or list in a page to update when
   state changes, so that structure follows state as it does in Preact.
8. As an app author, I want hosts in a reordered list to keep their
   identity, so that focus and component-local behaviour survive.
9. As an app author, I want the first page load to adopt the server's
   DOM, so that there is no flash and no duplicated rendering work.
10. As an app author, I want a clear error when the browser must create a
    component whose render link was stripped, so that I know to keep it.
11. As a component author, I want my component to receive values through
    props and report intent through events, so that it holds no
    application state.
12. As a component author, I want to assign a prop from JavaScript, so
    that a parent's setup can drive a nested host without attributes.
13. As a library consumer who does not use the templater, I want none of
    this in my bundle, so that hydration-only apps stay small.
14. As a visitor, I want the current page marked in the navigation, so
    that I know where I am.
15. As a visitor with a `count` query parameter, I want the counter to
    start at that number, so that server state is visibly request-driven.

## Implementation Decisions

### Library phase

**Types in core.** The core entry exports `Signal` and `Serialized<T>` as
types. `Serialized<T>` is a shallow unwrap: each property that is a signal
becomes its value type, and other properties pass through. No runtime
serialization helper ships in the library.

**Prop accessors in core.** Every host gets a property accessor for each
declared prop. Reading returns the current value. Assigning a plain value
writes the prop. Assigning a signal makes the prop read through to that
signal, so the setup context's prop signal tracks it. A property assigned
before the host is upgraded is picked up at upgrade, so callers need not
wait for the component to be registered. Accessor types derive from the
prop definitions. This is the only core runtime change.

**Browser build of the templater.** The templater subpath gains a second
module selected by the `browser` export condition. The import specifier is
the same on both sides; there is no runtime environment check. This adds a
build target alongside the existing three browser-entry scripts, and the
hydration example's dev alias must make the same split.

**Return type.** `html` returns opaque **markup** on both sides instead of
a string. On the server, converting markup to a string yields the HTML.
Markup, the output of a render function, and `raw` remain trusted strings
for escaping purposes; nesting never double-escapes. This is a breaking
change, acceptable at 0.0.x. Every existing caller that passes templater
output where a string is required converts explicitly.

**Server behaviour for reactive values.** A signal or function in any
hole is evaluated once. A signal or function in child position has its
output wrapped in a pair of comment markers (`<!--[-->` and `<!--]-->`).
Children passed to a component are wrapped in the same markers before the
render function receives them. A function-valued `on<event>` prop is
omitted. A page with no reactive holes and no component children produces
the same bytes as before.

**Binding rules in the browser, by position.**

- Signal as a component prop: assigned to the host's prop accessor.
- Signal or function as an attribute on a plain element: bound to that
  attribute; `false`, `null`, or `undefined` removes it.
- Signal or function in child position: a reactive region.
- `on<event>` with a function, on a plain element or a host: a listener.
- Anything else: static, as today.

**Mount.** The browser build exports `mount(container, markup)`. When the
container already has children it adopts them: it walks the markup against
the existing DOM in document order, binds props, attributes, listeners,
and regions, and creates no nodes. When the container is empty it creates
the nodes. It returns a dispose function that stops effects and removes
the listeners it attached, leaving the DOM in place. Mounting twice on one
container throws.

**Hosts are opaque.** Adoption and reconciliation never descend into a
component host's own markup. The only part of a host's subtree they enter
is the marked children range, if the component emitted one. A component
that drops its children has no range and its children are skipped.

**Reconciliation.** When a region re-evaluates, its old nodes are morphed
toward the new markup. Children carrying a `key` attribute are matched by
key and moved. Unkeyed children are matched by position and tag name and
patched in place. A matching host is kept and its props rebound; it is
never recreated.

**Stripped components.** Stripping is unchanged. When the browser must
create a component whose render link is absent, it throws an error that
names the tag name and points to `client: true` and the build-time keep
list.

**Adoption mismatch.** If the element at the expected position has the
wrong tag name, adoption warns in development and leaves the server DOM
untouched for that subtree.

**Size limits.** The size-limit entries are raised to the measured
results, and the browser build of the templater gets its own entry so
growth stays visible.

### Example phase

**State module.** Shared by both sides. `AppState` is signals of JSON
values only: `route`, `count`, `noticeOpen`, and the list's labels.
`State` takes an optional partial of `Serialized<AppState>` and fills
defaults for missing keys. Signals are written only inside static
functions on `State` (increase, decrease, open and dismiss the notice,
add and remove a label). A function that produces the serialized form
lives beside it. The module imports types from the package name, not from
library source paths.

**Server.** Each route handler builds state for the request. `route` is
the request path with the mount prefix removed; unknown paths keep the
requested path so the not-found page serializes state too. On the index
route, a `count` query parameter is accepted only when it is a finite
integer; otherwise the default of 5 applies. The handler renders the
layout around the page for that route and converts the markup to a string.
The options that tests inject today (heading and label) become plain
arguments to the page function, not state.

**Transport.** State is written as a JSON script element with a fixed id,
with `<` escaped so the payload cannot close the script. The scaffold
gains a second marker for it, placed before the module script. `assemble`
takes both the page and the state payload and throws unless each marker
appears exactly once.

**Scaffold.** The body holds a root element containing the page marker,
the runtime assertions section, the state marker, and the module script.
The navigation moves out of the scaffold into the layout.

**Pages.** A new shared directory holds one page function per route, a
layout, and a route table that both sides use to pick the page, including
the not-found page. The server-only route bodies module is removed. Pages
contain no builder chains, so the stripping filter does not need to match
them.

**Client entry.** Reads the state script and calls `State` with it. If
the script is absent it uses defaults; if the JSON is malformed it throws.
It picks the page from the route table and mounts the layout into the
root. It contains no DOM manipulation other than the runtime assertions
harness and the reveal helper.

**Counter.** One `count` prop replaces `start`, and the "start at" line
is removed. It holds no signal of its own. Its buttons emit `increment`
and `decrement` events with no detail. Its setup drives the nested badge
by binding a derived value to the badge host's `label` prop. Its render
link stays stripped.

**Badge.** Its setup binds `label` to its text element through a ref. It
is kept in the browser bundle, because the list page creates badges.

**Notice.** Shown by a conditional region driven by `noticeOpen`. Its
dismiss button emits an event; the page handler updates state. It no
longer removes its own host.

**List page.** Renders the labels signal as a keyed list with add and
remove controls.

**Navigation.** The layout renders the links and binds `aria-current` to
`route`. Routing stays on the server: every link is a full page load, and
the browser never changes `route`.

**Runtime assertions.** The badge assertion flips to "render is kept".
The counter assertion stays as the proof that stripping still works.

**Docs.** The example README, the agent instructions for this example,
and the glossary are updated. The glossary gains **markup**, **mount**,
**reactive region**, and **adopt**, and the entries for **templater**,
**trusted string**, **hydration**, and **prop** are revised.

## Testing Decisions

A good test here exercises behaviour through a public seam and asserts on
structure, identity, and state. No test asserts on specific text content
in HTML, and no test covers docs.

Seams, all existing:

1. **Server templater output**, in the Node SSR suite. Reactive child
   holes and component children are wrapped in markers; a page without
   them is unchanged from before; function-valued event props are
   omitted; markup converts to a string and nests without double
   escaping. Prior art: the existing round-trip and escaping cases in
   that suite.
2. **Browser templater and mount**, in the browser suite. Adoption
   preserves node identity and creates nothing; a signal prop updates a
   host; a prop accessor accepts a value, a signal, and a pre-upgrade
   assignment; a conditional region adds and removes its content; a keyed
   list reorders while each host keeps its identity; creating a stripped
   component throws; dispose stops further updates. Prior art: the
   existing component and example-import cases in that suite.
3. **Types**, in the type test file. `Serialized<AppState>` is plain
   values; prop accessors are typed from the prop definitions.
4. **The Hono app through `app.request()`**, in the hydration suite.
   Every route's response carries one state script that parses and
   round-trips through `State`; a valid `count` parameter is reflected in
   the state; an invalid one falls back; a path containing a script
   closing tag cannot break out of the payload; `assemble` throws on a
   missing or duplicated state marker. Prior art: the existing route and
   scaffold cases in that suite.
5. **End to end with Playwright** against the production listener.
   Clicking increment changes the counter's state from the server-provided
   value while the counter host keeps its identity; the notice opens and
   dismisses; the list adds and removes an item.

The dev-server suite and the listener suite keep passing unchanged in
intent; they are updated only where the scaffold shape changed.

## Out of Scope

- Client-side routing. Navigation stays a full page load.
- Shipping component render functions to the browser by default, or any
  change to how stripping decides what to remove.
- Runtime validation of the serialized state's shape.
- A recursive `Serialized<T>`, or serialization of non-JSON values.
- A library-level state container, serialization helper, or hydration
  subpath beyond the templater's browser build.
- Reconciling inside a component host's own markup.
- The non-hydration example, beyond the string conversion the return type
  change forces.

## Further Notes

- Order of work: ADR-007 and the library phase first, then ADR-008 and
  the example phase. Every example ticket is blocked by the library phase.
- The server templater change (markers, markup type) and the browser
  build can land separately; the server change alone must keep every
  existing suite green after callers convert markup to strings.
- The example imports the components by package name so the stripping
  plugin recognises the builder chain; the new pages directory follows
  the same rule for the templater import.
- After a signal is assigned to a prop accessor, the host's HTML
  attribute is no longer updated. Tests and docs must not treat the
  attribute as the current value.
- The example's production build output directory must be deleted before
  linting, as today.
