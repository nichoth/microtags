# ADR-004: Client bundle size outranks API ergonomics

**Date:** 2026-07-25

## Context

The reason microtags exists is to produce smaller client-side JavaScript
than the alternatives. This goal was stated explicitly on 2026-07-25 while
designing server rendering, when an always-on client-side render fallback
was on the table. It is not derivable from the code: the README mentions
size but not that size is the tie-breaker for every design choice.

## Decision

When a design choice trades client bundle size against ergonomics or API
elegance, size wins. Concretely:

- The core entry (`microtags`) is budgeted by size-limit, currently at
  3.5 kB minified and brotlied, and the measured number is shown in the
  README.
- Anything not needed by every component lives in a subpath export
  (`microtags/render`, `microtags/context`, `microtags/util`, and the
  planned `microtags/html`). The core entry re-exports nothing from them,
  so consumers pay only for what they import.
- Consumers may run with no bundler at all, resolving the package through
  an import map. A build-time transform is therefore always an optional
  optimisation and never required for correctness.

## Consequences

Any addition to the core entry is measured before it is accepted. The API
is somewhat fragmented: a component author imports from `microtags`, from
one or more subpaths, and from alien-signals directly.

The always-on client render fallback was rejected on this basis, which
led directly to the build-time stripping design in ADR-005.
