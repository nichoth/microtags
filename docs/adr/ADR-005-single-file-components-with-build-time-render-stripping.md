# ADR-005: Single-file components with build-time stripping of render code

**Date:** 2026-09-23

## Context

A component is a client-only module. It exposes its tag name and ref
names as statics so a server template can reference them, but the markup
itself lives in a separate server file (for example `example/ssr.ts`).
One component is split across two files, and the server file drifts from
the behaviour it describes. There is also no way to compose components
into a page as strings with escaping and nested expansion.

Moving the markup into the component would ship it to every browser, and
ADR-004 forbids that. Alternatives considered:

- Keep the separate server file. Rejected: drift is the problem.
- Markup in the component, always shipped. Rejected under ADR-004.
- A `<template>` element or declarative shadow DOM. Rejected: the
  template still has to be authored on the server, and ADR-002 rules out
  shadow roots.
- Usage analysis that keeps render code automatically for classes used in
  an `html` template. Deferred; too much machinery for the first cut.

## Decision

The builder gains a `.render(fn, { client? })` link before `.setup`. The
render function receives plain props, the ref name map, the tag, and
caller-supplied children and attrs, and returns the host's inner HTML.
After `setup`, the element class exposes statics `render` and `props`
beside `TAG` and `refs`. The attribute serializer and host-tag wrapper
live in the core entry, because the static `render` must call them and a
class member cannot be tree-shaken.

An `html` tagged template in a separate subpath, `microtags/html`,
composes pages and expands components recursively. It is built on `htm`,
which stays out of the core entry. Interpolated strings are escaped;
render output and `raw` strings are trusted.

A Node-only transform in `microtags/build` strips `.render(...)` from the
client code. The rule is syntactic: a `.render` link in a call chain
rooted at the `define` binding imported from `microtags`, with aliases
tracked. Removed spans become newlines so line numbers survive. An
optional cascade then removes imports and top-level declarations that only
the stripped code used. A component opts out with `{ client: true }` in
source or a `keep` list at build time. The parser is the `typescript`
package as an optional peer dependency. The transform ships as esbuild and
Vite plugins and as a `microbuild` CLI.

Implementation is tracked under `.scratch/ssr-render-and-microbuild/`.

## Consequences

Markup and behaviour have one source of truth, and a browser bundle
contains hydration code only. Other server templaters, such as Hono, can
call the static `render` directly.

The type declares `render` as always present while it is `undefined` at
runtime after stripping; this gap is accepted and documented. The build
step is opt-in, so import-map consumers ship render code, consistent with
ADR-004. `client: true` is only recognised in an object literal, and the
non-chained form `const b = define('x'); b.render(fn)` is unsupported.
The transform adds `typescript` as a peer for anyone who uses it. The
core size budget stays at 3.5 kB, and the delta from the serializer is
measured and reported.

## Note (2026-10-04)

[ADR-007](./ADR-007-client-templater.md) changes the templater's return
type: `html`, `h`, and `raw` return opaque markup instead of a string,
and callers that need HTML convert with `String(m)`. The render function
may return markup. A component that the browser creates (from `mount` or
a reactive region) must be kept, with `client: true` or the build-time
keep list; creating a stripped component throws. This ADR is not
superseded.

## Note (2026-10-14)

[ADR-009](./ADR-009-server-render-support-through-render-link.md)
amends this ADR. The host-tag builder, prop serializers and attribute
escaping no longer live in core. They are in the server render support
module (`microtags/render-support`), which the templaters load and
which core reaches only through a component's `render` static. A
browser bundle contains hydration code only when every render link is
stripped and the browser templater is not imported. A kept render link
or the browser templater brings the support module along. Code that
calls `render` directly, for example from Hono, imports
`microtags/render-support` once. The "core budget stays at 3.5 kB"
above is replaced by the budget recorded in ADR-009 (4 kB).
