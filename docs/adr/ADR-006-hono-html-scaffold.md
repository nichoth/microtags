# ADR-006: Authored HTML scaffold served by Hono

**Date:** 2026-09-25 (amended 2026-09-26)

**Status:** Accepted

## Context

The hydration example used to author its whole document inside a
template literal and generate an ignored `index.html`. None of the
ordinary HTML tooling applied, and the example did not show a server
choosing a route and returning a complete document, which is the
situation microtags is meant for.

See the [research report](../hono-vite-ssr-research.md) for source links,
alternatives, and repository findings. The report records the original
proposal (Hono JSX with two outlets); this ADR supersedes those details.

## Decision

`example-hydration/index.html` is the checked-in scaffold. It owns the
doctype, head, a static title, the nav, a `<main>` element, and the
client entry script. `<main>` holds exactly one `<!--microtags:main-->`
marker. The server replaces it once, through a callback so `$&` in
rendered text stays literal. Zero or several markers is an error.

A Hono app, mounted under `/example-hydration`, owns the routes: the
index (canonical with a trailing slash; the bare prefix redirects),
`/list`, and `/notice`. Other paths go through Hono's not-found handler,
which returns the scaffold with a not-found body and a 404 status.

Route bodies are composed with the `html` templater from
`microtags/htm`, expanding components through their render links. Hono
JSX is not used.

The example is split by where code runs: `client/` (browser only),
`components/` (both sides), and `server/` (Node only). The app module
has no Node imports and takes an injectable scaffold loader. In
development `@hono/vite-dev-server` runs the app inside Vite, with the
scaffold passed through Vite's HTML transform. In production a Node
listener loads the built scaffold once, mounts the app, and then serves
built assets with static middleware, so the scaffold is never served
unassembled.

The microtags Vite plugin skips modules whose environment consumer is
`server`, so server builds keep render links.

## Trade-offs

An HTML source keeps normal document editing and Vite asset handling,
at the cost of a small outlet contract. A JSX layout would allow
per-route titles and more outlets, but would make TSX the document
source and add a server-side JSX runtime. One outlet and a static title
are enough for the example.

Hono adds a server runtime and development integration. It adds no
browser runtime because it stays out of the client import graph.

## Consequences

Source HTML is distinct from the built template. Client and server are
built separately into `example-hydration/build/`. Tests cover
server/client stripping, complete responses through `app.request()`,
and the browser against the production listener (Playwright).

This decision preserves ADR-004's browser-size priority and ADR-005's
component render methods. It supersedes neither.

## Note (2026-10-04)

[ADR-008](./ADR-008-serialized-server-state.md) adds a second scaffold
marker, `<!--microtags:state-->`, placed before the module script, where
the server writes the serialized state as a JSON script. `assemble`
takes the page and the state payload and throws unless each marker
appears exactly once. The page marker now sits inside a `<div
id="root">` wrapper, which the client mounts the layout into, and the
navigation moved from the scaffold into the layout. This ADR is not
superseded.
