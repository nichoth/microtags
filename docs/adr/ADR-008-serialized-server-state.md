# ADR-008: Serialized server state and unidirectional hydration

**Date:** 2026-10-04

**Status:** Accepted

## Context

The hydration example scattered application state across component
hosts. The counter owned its own count, seeded from an attribute; the
server hard-coded the values it rendered; and the browser had no way to
learn what state the server rendered from. ADR-007 gives the templater a
browser build and `mount`, so the same page function can run on both
sides -- but only if both sides start from the same state.

Alternatives considered:

- Read state back out of the rendered DOM (attributes, text). Rejected:
  it couples state to presentation, and not every value is rendered.
- A library-level state container or hydration helper. Rejected: out of
  scope for the library, and it would grow the core bundle (ADR-004).
- Serialize every signal automatically. Rejected: it hides which data
  crosses the wire; an explicit serialize function keeps it visible.

## Decision

One state object per request on the server and one per page load in the
browser, both built by the same `State` function in
`example-hydration/state.ts`. `AppState` holds signals of JSON values
only. `State` takes an optional partial of `Serialized<AppState>` and
fills defaults. Signals are written only inside static functions on
`State`. A `serialize` function beside it produces the plain form.

Each route handler builds state for the request. `route` is the request
path without the mount prefix; unknown paths keep the requested path.
Query input (`count` on the index route) is accepted only when valid,
otherwise the default applies.

The server writes the serialized state into the document as an inert
`<script type="application/json">` with a fixed id. `<` is escaped as
`<` so the payload cannot close the script. The scaffold has a
second marker for it, before the module script, and `assemble` throws
unless both the page marker and the state marker appear exactly once.

The browser reads the script, calls `State` with it, picks the page from
a shared route table, and mounts it over the server-rendered DOM.
Routing stays on the server: every navigation is a full page load.

## Trade-offs

- State is duplicated in the payload and in the rendered HTML, so pages
  are slightly larger.
- `Serialized<T>` is shallow and there is no runtime validation of the
  payload's shape. A malformed payload throws in the browser rather than
  being repaired.
- Only JSON values can live in `AppState`.

## Consequences

- Components stop owning application state; they receive it as props
  and emit events, and page handlers call `State` mutators.
- Every response, including the 404, carries a state script.
- Changing the scaffold means keeping both markers; tests assert on
  `assemble` throwing for a missing or duplicated marker.
- Inputs that reach the payload from the request (path, query) must go
  through the escaping in `stateScript`.

## Note (2026-10-14)

The sibling repo millitags measured the cost of carrying state twice on
2026-08-18, with its own toolchain (its ADR on inline markup and route
bundles, section "The narrowed serialization payload", and the header
of its `src/revive.ts`). The figures are millitags', not re-measured
here.

Fifty rendered items, brotli compressed:

| Shipped as          | Size  |
| ------------------- | ----- |
| HTML alone          | 509 B |
| JSON payload alone  | 496 B |
| HTML and payload    | 967 B |

Sending both cost 967 B against 1005 B for the two compressed
separately, so the compressor recovered about 7.7% of the duplicated
data. Compression does not make the duplication free.

Brotli import cost of a deserializer:

| Reviver      | Size        |
| ------------ | ----------- |
| `JSON.parse` | 32 bytes    |
| flatted      | 377 bytes   |
| devalue      | 1959 bytes  |
| turbo-stream | 2477 bytes  |
| seroval      | 3425 bytes  |

Each library is larger than a hand-written reviver, which millitags
kept under 250 bytes. devalue, turbo-stream and seroval are each more
than half of millitags' core bundle (3519 bytes brotli).

These numbers support the decision above rather than change it: the
cost of the duplicated state is bounded by keeping the payload narrow,
and `JSON.parse` stays the reviver, because every library reviver
measured adds bytes to the client bundle, which ADR-004 ranks first.
