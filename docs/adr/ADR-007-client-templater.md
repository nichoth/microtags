# ADR-007: Client templater with signal props, reactive regions, and mount

**Date:** 2026-10-04

**Status:** Accepted

## Context

The `html` templater in `microtags/htm` runs only on the server. It
returns a string, escapes interpolated values, and expands components
through their render links. In the browser there is no way to describe
the page, so application state lives in each component's own signals and
page-level behaviour is manual DOM code: query an element, add a
listener, assign `innerHTML`.

An author coming from React or Preact expects one state object, passed
down, changed through named functions, with the DOM following on its
own. To support that, the same page function must run on both sides: on
the server to produce HTML, and in the browser to adopt that HTML and
keep it in sync with state.

ADR-004 says client bundle size outranks ergonomics. A browser templater
with binding and reconciliation is real code. The maintainer has waived
strict size limits for this work, for the templater subpath only.

Alternatives considered:

- Keep page code imperative and only lift state into one object.
  Rejected: the DOM would still be wired by hand, which is the problem.
- Ship a virtual DOM library. Rejected: it re-renders whole trees, and
  it does not know about microtags hosts or the server's markup.
- Re-render regions by assigning `innerHTML`. Rejected: it recreates
  hosts, losing their state and identity.

## Decision

The core entry exports `Signal` and `Serialized<T>` as types.
`Serialized<T>` is a shallow unwrap: each property that is a signal
becomes its value type, and other properties pass through. No runtime
serialization helper ships in the library.

Every host gets a property accessor for each declared prop. Assigning a
plain value writes the prop; assigning a signal makes the prop read
through to it. A property set before upgrade is picked up at upgrade.
This is the only runtime change to the core entry.

`microtags/htm` gains a second module, selected by the `browser` export
condition. The import specifier is the same on both sides, with no
runtime environment check. `html` returns opaque **markup** on both
sides instead of a string. Server markup converts to its HTML with
`String()`. Markup, render output, and `raw` stay trusted, so nesting
never double-escapes.

On the server, a signal or function in a hole is evaluated once. In
child position its output is wrapped in `<!--[-->` and `<!--]-->`
markers. Non-empty children passed to a component are wrapped in a
distinct opening marker, `<!--[c-->`, closed by the same `<!--]-->`.
A function-valued `on<event>` prop is omitted. A page with no reactive holes and no
component children renders the same bytes as before.

In the browser, holes bind by position:

- A signal as a component prop is assigned to the host's prop accessor.
- A signal or function as an attribute on a plain element is bound to
  that attribute; `false`, `null`, or `undefined` removes it.
- A signal or function in child position is a **reactive region**.
- `on<event>` with a function becomes a listener.
- Anything else is static.

`mount(container, markup)` **adopts** existing children: it walks the
markup against the DOM in document order, binds, and creates no nodes.
An empty container gets new nodes. It returns a dispose function that
stops effects and removes listeners, leaving the DOM in place. Mounting
twice on one container throws.

Correction (2026-10-14): "binds, and creates no nodes" now holds for
attributes too. Adoption writes no static attribute values. A bound
attribute's first run compares against the attribute already there
(and its presence, for the remove case) and writes only when the value
differs; later runs write as usual. Adopting no longer reloads iframes
or media.

Hosts are opaque. Adoption and reconciliation never descend into a
host's own markup, only into its marked children range, if any. The
browser finds that range by its `<!--[c-->` marker, skipping nested
hosts, and matches its close by nesting depth, so a region in the
host's own render is never mistaken for the children.

When a region re-evaluates, its old nodes are morphed toward the new
markup. Keyed children are matched by `key` and moved; unkeyed children
are matched by position and tag name and patched. A matching host is
kept and its props rebound, never recreated.

Stripping is unchanged. Creating a component whose render link was
stripped throws an error naming the tag and pointing at `client: true`
and the build-time keep list. An adoption mismatch on tag name always
warns (there is no development flag) and leaves that server subtree
untouched. Adoption then looks ahead through the later sibling nodes
in the same range, stepping over regions, for the first element with
the expected tag. If it finds one, it adopts that element and leaves
the skipped server nodes in place. If not, the next markup item is
tried against the same node. One extra or missing server node costs
one warning, and later siblings stay bound.

## Trade-offs

App code gets one state object and no manual DOM work, at the cost of a
larger templater subpath. Consumers who do not import `microtags/htm`
pay nothing; the core entry grows only by the prop accessors.
(Corrected 2026-10-14: core also grew by the host-tag builder, prop
serializers and attribute escaping, which every `define()` pulled in.
ADR-009 moves them to the server render support module.)

Value updates go straight through signals with no diffing. Only
structural changes (conditionals, lists) pay for a morph, and only over
the affected region.

Changing the return type of `html` from string to markup is a breaking
change. It is acceptable at 0.0.x, and callers convert explicitly.

Comment markers add a few bytes to server output where reactivity is
used, and nothing where it is not.

Treating hosts as opaque keeps reconciliation simple and leaves a
component's internals to its own setup, but a region cannot patch inside
a host's markup.

## Consequences

ADR-004 is relaxed for the templater subpath only. Its size-limit entry
is raised to the measured result, and the browser build gets its own
entry so growth stays visible. The core entry stays budgeted as before.

Note (2026-10-14): both templaters brand `Markup` with
`Symbol.for('microtags.markup')` and check the brand instead of
`instanceof`, so markup from another copy of the package renders as
markup, not escaped text. The browser build measured 4.61 kB after this
change, and its limit was raised to 4.65 kB. Merged with the adoption
and morph changes it measured 4.71 kB, and the limit is 4.75 kB.

ADR-005 still holds: render links are stripped by default. A component
created in the browser, for example as a list item, must be kept with
`client: true` or the keep list.

After a signal is assigned to a prop accessor, the host's attribute no
longer tracks the current value. Tests and docs must read the property,
not the attribute.

A bound prop is read-only inside the component. Calling the setup prop
signal with a value while a signal or computed is bound throws an error
naming the tag and the prop, so a component cannot write page state
directly and a write to a computed is not silently dropped. Unbound
props stay writable by their own component.

The package gains a fourth browser build script and a `browser`
condition on the `./htm` export. Bundler aliases that point
`microtags/htm` at source must make the same split.

This ADR supersedes no earlier decision. ADR-008 records how the
hydration example uses it.

## Notes

2026-10-14: component children originally shared the region marker.
A kept component whose render had a reactive region before its
children was then adopted against the wrong range, leaving the
children's listeners unbound. Children now open with `<!--[c-->`.
Server output changes only for components with non-empty children;
static pages are byte-identical.

2026-10-14: a multi-node `raw()` value is now adopted one DOM node per
parsed node, with no skipping inside the span, so adoption stays
aligned after it. With passive adoption, the guarded `moveBefore` and
the duplicate key check, the browser templater measures 4.68 kB, and
its size limit is 4.7 kB.

2026-10-14: a tag mismatch during adoption used to advance past the
server node and consume the markup item, so one extra or missing node
misaligned every later sibling. Adoption now looks ahead for the
expected tag, and otherwise retries the next item against the same
node. The warning is unconditional; the earlier "warns in development"
wording was wrong, since the library has no development flag. With
this lookahead the browser templater measures 4.99 kB, and its size
limit is 5 kB.

2026-10-14: per ADR-009, the browser templater registers the server
render support module when it creates a host, so a kept component's
`render` static works with no separate import. Carrying that module,
the browser templater measures 5.25 kB (with the mismatch lookahead
above), and its size limit is 5.3 kB.

2026-10-14: the mismatch lookahead steps over only real region and
children markers (`[` or `[c`, not any comment starting with `[`) and
stops at the range's `end`, so it never adopts an element outside the
range. A text node in a `raw()` span consumes only a text node, since
text before the span merges with the span's leading text. The browser
templater measures 5.31 kB, and its size limit is 5.35 kB.
