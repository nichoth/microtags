# ADR-011: Core renders an empty host with a kept render link

**Date:** 2026-11-10

**Status:** Accepted

**Amends:** [ADR-010][adr-010]

**Related:** [ADR-004][adr-004] (client size), [ADR-009][adr-009]
(render links and render support)

## Context

A client-rendered component keeps its render link in the browser
bundle so it can produce its own markup after page load. A page asks
for that by inserting an empty host: `document.createElement`,
`innerHTML`, or hand-written `<number-input></number-input>`.

Core resolved refs against the host before setup ran, and it never
rendered into the host. For an empty host every `r.one` ref was
missing, so connect threw "missing refs" and setup never ran. The
workaround in `../components` had three parts, copied into every
client-rendered component: declare every ref with `r.all` so
resolution cannot throw, render the host's inner HTML in setup from
`host.constructor.renderParts`, then look each element up again by
`data-ref` because the setup context's refs were resolved before the
render. The ref types were wrong (arrays for single elements), the
setup context's `refs` were stale, and setup had two code paths.

## Decision

When a host connects empty and its class has a `renderParts` static,
core writes the parts' `html` into the host, then resolves refs, then
runs setup.

- **Ordering.** The render runs in the factory's connect path, after
  the required provided contexts are available and immediately before
  refs are resolved. A host waiting on a context stays empty until
  setup is about to run.
- **Empty.** No element children, no comments and no non-whitespace
  text (the inner HTML is whitespace). A host with any element child,
  comment or text is treated as server markup and left alone (the
  hydration case), including a host the page filled with its own
  children. Comments count because a templater or server host whose
  children region is empty holds only its `<!--[c-->`/`<!--[-->`
  markers, and those must survive for the region to work.
- **Input.** The current value of every declared prop, read through
  the host's accessors after attributes are applied, so attributes,
  properties set before upgrade and bound signals all reach the
  render. No children and no extra attrs.
- **Output.** Only `html` is written, as inner HTML. The parts' `tag`
  and `attrs` are ignored: the host exists and core does not rewrite
  its attributes.
- **Once.** After the first render the host is not empty, so a host
  torn down and reconnected later is not rendered again.
- **Statics are read at connect time** from `this.constructor`. The
  factory does not know about them (`setup` in the builder defines
  them after `factory` returns), and a host upgraded inside the builder
  chain sees them because they are set before `customElements.define`.
- **No render link (a Light Module).** Nothing is rendered, ref
  resolution runs as before, and an `r.one` ref throws the existing
  missing-refs error naming the tag and the refs. A Light Module
  expects server markup, so an empty host is a usage error and failing
  loudly beats a component that silently does nothing. No new message
  is added to core; the README documents the cause.
- **Render link kept, render support not loaded.** The `renderParts`
  static throws its existing error naming `microtags/render-support`,
  and that error propagates from the connect path.

## Rejected alternatives

- **A call-time ref lookup on the setup context** (`ctx.one`). It
  would add a second way to get a ref with different failure timing
  and leave the setup context's `refs` wrong.
- **Leaving it to each component.** That is the three-part workaround
  above, repeated in every client-rendered component.

## Trade-offs

- **Size.** Core grows from 3.99 kB to 4.06 kB brotli, and its limit
  is raised from 4 kB to 4.1 kB. This is accepted because it removes
  per-component code from every client-rendered component.
- **Not ADR-004's rejected client render fallback.** That fallback
  would have shipped render code to every page. This change ships no
  render code: core only calls a render link the build kept. A
  stripped class still has no render code in the browser, and the
  render support module is still loaded only through a kept link.
- A page that wants a component with slotted children cannot get a
  client render from core; a non-empty host is always server markup.

## Consequences

- Setup has one code path. `r.one` refs on a client-rendered host
  resolve to the rendered elements, and the setup context's `refs` are
  current.
- An empty host whose render link was stripped throws missing refs
  when it declares an `r.one` ref. With no `r.one` refs it still runs
  setup with an empty host, as before.
- The Preact adapter (ADR-010) is unchanged. On a client-only mount it
  writes the inner HTML before the host connects, so core sees a
  non-empty host and does not render again. While Preact hydrates, the
  host has server markup and core does not render.
- The browser templater creates hosts already filled, so pages
  composed with `html` and `mount` do not reach this path.

No ADR is superseded.

[adr-004]: ./ADR-004-client-bundle-size-outranks-ergonomics.md
[adr-009]: ./ADR-009-server-render-support-through-render-link.md
[adr-010]: ./ADR-010-preact-adapter-ownership-split.md
