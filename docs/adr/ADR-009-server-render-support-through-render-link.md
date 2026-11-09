# ADR-009: Server render support loaded through the render link

**Date:** 2026-10-14

**Status:** Accepted

**Amends:** [ADR-005][adr-005]

## Context

ADR-005 put the attribute serializer and the host-tag wrapper in core,
because a component's static `render` calls them and a class member
cannot be tree-shaken. Its consequences claim that a browser bundle
contains hydration code only. That is not true. `withProps` computes a
serializer for every prop, and `setup` installs a `render` static that
closes over the host-tag builder, the serializers and attribute
escaping. All of it is reachable from `define()`, so stripping every
`.render` link removes the user's render bodies but never this code.

The review of 2026-10-13 (finding 8) measured the result. Core grew
from 3.48 kB to 4.17 kB brotli, and the core size limit was raised to
4.2 kB to match. Stripping saved 3% of the example's client bundle.

The fix is to move the host-tag builder, the serializers and attribute
escaping into a separate server render support module. Core keeps only
what it needs to describe a component: prop metadata, ref names, tag and
render function. Something then has to connect the two at runtime
without core importing the support module. The spec named three
candidates:

- **A, side-effect subpath.** Core holds a private slot.
  `import 'microtags/render-support'` fills it. Core's public API does
  not change.
- **B, setter exported from core.** Core exports `setRenderSupport`.
  The support module exports the render function, and whoever needs it
  (templater, transform, user) passes one to the other.
- **C, module-level hook.** The support module, on import, stores its
  render function on `globalThis` under a registry symbol,
  `Symbol.for('microtags.render')`. Core reads that symbol when `render`
  is called. Neither module imports the other.

## Prototype and measurements

The prototype is in `.scratch/hydration-dx-fixes/prototype-12/`. It is
not part of `src/`. `measure.sh <variant>` copies the repo to a temp
dir, overlays the variant, and builds the minified browser entries the
same way `build-esm:min` does. It then bundles two fixtures with
esbuild `--bundle --minify` and measures everything with `size-limit`
(brotli), as the review did. It also runs the SSR suite against the
copy and two smoke checks.

All three variants share one core change (`common/builders.ts`). Prop
metadata is `{ kind, coercer }`, where `kind` is one of `prop-only`,
`schema`, `boolean`, `json` or `coercer`. Core decides the kind by
coercer identity, so the support module never compares coercers.
`setup` installs a `render` static only when a render link exists. It
packs tag, metadata, frozen ref names and render function into one
record and delegates to the registered support function. The templaters
import the registration module, so the server templater always
registers it and the browser templater registers it before it can
create a host.

Fixtures: `all-stripped.ts` is a component with props, refs and setup
but no render link, which is what the transform leaves when it strips
every link. `kept.ts` is the same component with its render link and
the import the transform would inject.

Sizes in kB, brotli:

| Bundle | Baseline (HEAD) | A subpath | B setter | C global |
|---|---|---|---|---|
| core (`index.min.js`) | 4.17 | 3.90 | 3.90 | 3.92 |
| `microtags/htm` (server) | 1.43 | 1.70 | 1.70 | 1.71 |
| `microtags/htm` (browser) | 4.56 | 4.81 | 4.81 | 4.80 |
| all-stripped fixture | 3.81 | 3.58 | 3.58 | 3.62 |
| kept-render fixture | 3.84 | 3.90 | 3.89 | 3.91 |

The baseline row reproduces the review's figures for core, `htm` and
the browser templater.

For every variant, the all-stripped bundle has no `render-static.ts` in
its esbuild metafile and no attribute escape table in its output. The
baseline bundle has both. The SSR suite passes 79/79 in every variant
with no test changed, so host HTML is byte-identical.

Smoke checks:

1. Calling `render` with no templater and no support import throws in
   A, B and C. In the baseline it renders.
2. Core and the server templater from two separate copies of the
   source (`cross-copy.ts`). A and B throw: the templater fills its own
   copy's slot, and core reads a different one. C renders, and boolean
   props serialize correctly.
3. Core and the server templater from the CJS build, which has no code
   splitting, so `index.cjs` and `htm.cjs` each inline their own copy
   of every relative module. A throws. C renders.

## Decision

Use C, the module-level hook keyed by `Symbol.for('microtags.render')`.

The server render support module (proposed subpath
`microtags/render-support`) holds the host-tag builder, the prop
serializers and attribute escaping. When imported, it stores its render
function under the registry symbol. Core installs a minimal `render`
static on any component with a render link. That static reads the
symbol at call time and, if nothing is registered, throws an error
naming the support subpath. The server templater and the browser
templater import the support module. The `microtags/build` transform
injects the same import into any client module where it keeps a render
link (ticket 14).

Core records the serializer kind in prop metadata, so the support
module has no coercer identity checks and no import from core. The
registry symbol is the same pattern the spec chose for branding
`Markup`.

### Why A and B lost

Size does not separate the variants. Every row is within 0.04 kB, which
is noise at this scale. Packaging does separate them.

A and B both rely on a module-level slot in core, and the slot is only
shared when every importer resolves to the same module instance. This
package does not guarantee that. `build-cjs` and `build-esm:min` bundle
each entry standalone, so `index.cjs` and `htm.cjs` each get a private
slot, and so do `index.min.js` and `htm.min.js`. Only the split ESM
build shares one. Under A, a CommonJS server that requires `microtags`
and `microtags/htm` throws on the first render, as smoke check 3 shows.
An app that ends up with two copies of the package, through nested
dependencies or a CDN copy beside a bundled one, fails the same way.
Fixing that would mean changing how every build emits its entries.

B has the same slot problem. The caller must also call the setter on
the right copy of core, and the transform would inject two statements
instead of one import. It also adds an export to core's public API.
That costs about the same bytes as C, but the export cannot be
withdrawn later without a breaking change.

C needs no shared module instance. Any copy of the support module
serves any copy of core.

## Trade-offs

- C uses global mutable state. Registration is a single write of a pure
  function and is never undone, so there is no ordering or cleanup
  issue. But if two versions of the package are loaded, the last one
  imported wins. The record that core passes to the support function
  (tag, metadata, refs, render function) is now a cross-version
  contract. Changing its shape needs a new symbol key, such as
  `microtags.render.2`.
- `render` fails at call time, not at import time. The error names the
  module to import, so it is easy to fix.
- The server templater grows by about 0.28 kB because it now carries
  the support module. It runs on the server, so that is acceptable.
- The browser templater grows by about 0.24 kB for the same reason. It
  is already at its 4.6 kB limit, and findings 3, 4, 9 and 12 add more.
  The spec's rule applies: raise the limit to the measured size rounded
  up to the next 0.05 kB, and record it in ADR-007's note.
- A kept-render client bundle grows by about 0.07 kB over the baseline.
  That covers the delegating static, the render record and the error
  message. A shorter message recovers part of it.

## Consequences

**Breaking change.** Code that calls a component's `render` static
directly, without the server or browser templater, must import the
support subpath once, for example `import 'microtags/render-support'`.
Without that import, `render` throws. Hono handlers and other server
templaters that call `El.render(...)` are affected. This is acceptable
at 0.0.x, and the README must document it when the change lands
(ticket 13).

With every render link stripped and no templater import, the client
bundle has none of the host-tag, serializer or escaping code. In the
prototype that took a representative component from 3.81 kB to
3.62 kB. Core alone shrank from 4.17 kB to 3.92 kB. Ticket 13 lowers the
core size limit to its measured size rounded up to the next 0.05 kB
(3.95 kB for the prototype) and records the final number here. Ticket 14
repeats the spec's end measurements.

The hydration example keeps Badge and Notice (`client: true`), because
its pages create them in the browser, and it imports the browser
templater. So its client bundle still ships the support module, and
this change does not shrink it. The win is for apps that strip every
render link and do not use the browser templater.

ADR-005 is amended, not superseded. Its claim that the serializer and
host-tag wrapper must live in core no longer holds. Neither does its
claim that a browser bundle contains hydration code only, unless a
render link is kept. Its "core budget stays at 3.5 kB" is replaced by
the budget recorded here. Ticket 13 adds the matching note to ADR-005.

## Note (2026-10-14): implementation

Ticket 13 landed the decision. The support module is
`src/render-support.ts`, exported as `microtags/render-support`. The
server templater imports it. The browser templater imports it and
calls its `register` before it creates a host, so registration
survives anything that cleared the symbol. With the error message
shortened to name only the subpath, core measures 3.93 kB brotli, and
its size limit is 3.95 kB. The server templater measures 1.93 kB and
the browser templater 5.18 kB (limit raised to 5.2 kB, noted in
ADR-007). The size limits were already higher than the prototype's
baseline because other tickets of the same spec landed first.

After merging the base branch, which added the typed bind helper and
the adoption mismatch lookahead, core measures 3.96 kB and its size
limit is 4 kB. The browser templater measures 5.25 kB and its limit is
5.3 kB.

## Note (2026-10-14): transform and final measurements

Ticket 14 made the `microtags/build` transform append
`import 'microtags/render-support'` to any module where it keeps a
render link, unless the module already imports it. It is appended after
the last line so no existing line moves. A module where every link was
stripped gets no import, with or without `cascade`. The plugins suite
bundles two fixtures with the esbuild plugin and checks the metafile:
the all-stripped fixture has no support module input, and the
kept-render fixture has one.

Final sizes in kB, brotli, measured with `size-limit` as above:

| Bundle | Size |
|---|---|
| core (`index.min.js`) | 3.96 |
| `microtags/htm` (server) | 1.93 |
| `microtags/htm` (browser) | 5.29 |
| example client, stripping on | 8.52 |
| example client, stripping off | 8.64 |
| all-stripped fixture | 3.63 |
| all-stripped fixture, no plugin | 3.65 |
| kept-render fixture | 3.95 |

The fixtures are `test/fixtures/support-stripped.ts` and
`support-kept.ts`, bundled with `--minify` against source. The
all-stripped fixture contains no support code even without the plugin,
because core never imports it; the plugin only removes the render body.
The kept-render fixture adds the support module, about 0.3 kB. As
expected, the example's client still carries the support module through
the browser templater and Badge and Notice, so stripping saves only
0.12 kB there (Counter's render body).

[adr-005]: ./ADR-005-single-file-components-with-build-time-render-stripping.md
