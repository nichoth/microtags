# Hydration DX fixes: server/client parity, quiet adoption, smaller client

**Status:** ready-for-agent

**Date:** 2026-10-14

Source: the adversarial review in
`.scratch/unidirectional-hydration/review-2026-10-13-hydration-dx.md`
(branch `wip-adding-hono-to-hydration-example` at 6675566). Finding
numbers below refer to that review.

This spec follows `.scratch/unidirectional-hydration/spec.md`, which
is complete. It changes behaviour recorded in ADR-005 and ADR-007 and
adds one new ADR (ADR-009) for the core restructure. ADR-008 stays as
it is. No ADR is superseded; ADR-005 and ADR-007 get notes and
corrections.

## Problem Statement

The hydration example promises five things: events up and state down,
one codebase rendered on both sides, a client that adds interactivity
to the server-rendered page, a client that does not re-render that
page, and a client bundle smaller than the server one. Right now it
keeps some of them only partly, and at HEAD it does not build.

An app author who clones the branch and runs `start:hydration`,
`build:hydration` or any hydration test gets a misleading "typescript
is a missing peer dependency" error, even though TypeScript is
installed.

Once that is fixed, the server and the browser still disagree about
the same markup. The server escapes interpolated attribute values
twice and writes `true`, `false` and `null` as literal strings, so a
link with `&` in its query points at the wrong URL until JavaScript
runs. Crawlers always see the wrong URL. Host attributes stay wrong
for good. Page inputs that only the server receives are overwritten
when the browser mounts.

Adoption claims to create nothing, but it writes every static
attribute again. That reloads iframes and media, and a
MutationObserver sees a burst of attribute writes on every page.
Adoption also loses its place after a multi-node `raw()` value or
after a kept component whose own render has a reactive region before
its children. In both cases it silently leaves listeners unbound.
After one tag mismatch, every later sibling misaligns.

"Events up, state down" is only a convention. A component can write
straight into a page-owned signal through a bound prop. When the prop
is bound to a computed, the write is silently dropped.

The page is invisible until JavaScript runs. If the script fails to
load, it stays invisible, so the server-rendered HTML is no fallback.

Stripping saves 3% of the client bundle. The code that builds a host
tag and serializes props is wired into `define()`, so it ships whether
or not any render link survives. Meanwhile core grew from 3.48 kB to
4.17 kB, and the size budget was raised to match.

## Solution

Fix the example's build and make the server and the browser produce
the same markup for the same input, checked by one shared table of
expectations. Make adoption truly passive. It writes nothing for
static attributes, stays aligned across `raw()` values and component
children, and recovers from a mismatch without throwing off every
sibling. Make a bound prop read-only to the component that receives
it. Remove server-only page inputs and the opacity gate, so the
server HTML is the complete page and stays visible without
JavaScript.

Restructure core so that the server-render code (host tag, prop
serializers, attribute escaping) is reachable only through a render
link. A client bundle where every render link was stripped then drops
it entirely. Lower the core size budget to the new measured size and
record the decision in ADR-009.

Fix the six places where the docs and ADRs contradict the code.

## User Stories

1. As an app author, I want `start:hydration`, `build:hydration` and
   the hydration tests to work from a fresh clone, so that I can try
   the example without debugging the build.
2. As an app author, I want a clear error that says the build entry
   was loaded where `require` is unavailable, so that I am not told to
   install a TypeScript I already have.
3. As a site visitor, I want links and attributes in server HTML to be
   correct before JavaScript runs, so that clicking early, or never
   loading JavaScript, still takes me to the right place.
4. As a crawler, I want server HTML whose attribute values match what
   the browser would produce, so that I index real URLs.
5. As an app author, I want boolean and null attribute values to
   render the same way on the server as in the browser (`true` is an
   empty attribute, `false` and `null` are omitted), so that one page
   function means one output.
6. As a site visitor, I want hydration to leave server-rendered
   attributes alone, so that iframes, video and audio do not reload
   when the page becomes interactive.
7. As an app author, I want adoption to stay aligned after a `raw()`
   value that holds several nodes or whitespace, so that handlers after
   it are bound.
8. As an app author, I want a kept component's children to be adopted
   even when its own render has a reactive region before them, so that
   child listeners are bound.
9. As an app author, I want one extra or missing server node to cost
   one warning, not misalignment of every later sibling, so that a
   small drift does not break the rest of the page.
10. As an app author, I want a component that writes to a bound prop
    to fail loudly with a message telling me to emit an event, so that
    "events up, state down" is enforced, not just suggested.
11. As an app author, I want every input to a page function to come
    from serialized state, so that the browser mounts exactly what the
    server rendered.
12. As a site visitor, I want the server-rendered page to be visible
    even if the client script fails to load, is blocked, or throws.
13. As an app author, I want example components to avoid rewriting
    text that the server already rendered, so that I copy a pattern
    that does not churn the DOM.
14. As a site visitor, I want a path outside the app's prefix to show
    the not-found page with a 404, not a real page with a 404 status.
15. As an app author, I want `/index.html` to mark the home link as
    current, like `/` does.
16. As an app author, I want an error when I mount markup produced by
    a different copy of the templater, so that I do not get escaped
    HTML on screen with no explanation.
17. As an app author, I want a typed way to bind a signal to a nested
    host's prop, so that I do not need `as unknown as` casts.
18. As an app author who strips every render link, I want the client
    bundle to contain no server-render code, so that stripping
    actually shrinks what the browser downloads.
19. As a consumer of core alone, I want the core budget to shrink back
    toward its old size, so that the bundle-size priority in ADR-004
    holds.
20. As a maintainer, I want AGENTS.md, the example README and the ADRs
    to describe the code as it is, so that agents and readers are not
    misled.

## Implementation Decisions

### Example build (finding 1)

- The example's Vite config imports the plugin from the built Node
  entry again, not from source, as AGENTS.md and the example README
  already say.
- The `microtags/build` entry tells the two failure modes apart. When
  `require` is undefined (an ESM context such as a Vite config
  bundle), the error says the entry must be loaded from its built
  form, or that `require` is unavailable. The "install typescript"
  message is kept for a real resolution failure.

### Server attribute serialization (finding 2)

- In the server templater, attributes on plain elements and non-prop
  attributes passed to a component unwrap the templater's escaped
  wrapper to its original string before escaping once. Declared props
  already do this.
- Non-prop attributes on a component follow the browser's rules: `true`
  is an empty attribute, `false`, `null` and `undefined` are omitted,
  and anything else is stringified once. This matches the browser
  templater's component-argument handling and the plain-element branch
  of the server templater.
- Static pages stay byte-identical. The existing exact-string
  assertions in the SSR suite must still pass unchanged.

### Passive adoption (finding 3)

- During adoption, static attribute values are not written. Only
  function- or signal-valued attributes are bound.
- A bound attribute's first run during adoption compares against
  `getAttribute` (and presence, for the remove case) and writes only
  when the value differs. Later runs write as they do today.
- After this change, ADR-007's "binds, and creates no nodes" holds for
  attributes too. ADR-007 gets a correction saying adoption writes no
  attributes whose values already match.

### Adoption alignment (finding 4)

- A `raw()` item is adopted by consuming exactly as many DOM nodes as
  its parsed content holds, with no whitespace or comment skipping
  inside that span. Skipping still applies before and after it. Server
  output for `raw()` does not change, so static pages stay
  byte-identical.
- Component children are wrapped in a distinct opening marker
  (`<!--[c-->`) instead of the region marker, and the browser finds a
  host's children range by that marker, matching its close by nesting
  depth. The server templater emits it, the browser `String()` path
  does not emit markers (unchanged), and adoption fixtures use it.
  The glossary entry for **Reactive region** and ADR-007 note the
  separate children marker.

### Mismatch recovery (finding 9)

- On a tag mismatch, adoption looks ahead through the later sibling
  elements in the same range for the first element with the expected
  tag. If found, it adopts that element and leaves the skipped server
  nodes untouched. If none is found, it warns and does not advance
  the DOM cursor, so the next markup item is tried against the same
  node.
- Warnings stay unconditional. There is no dev flag in the library, and
  adding one is out of scope. ADR-007 is corrected from "warns in
  development" to "always warns", and describes the lookahead.

### Read-only bound props (finding 5)

- While a signal (or computed) is bound to a prop through the host's
  prop accessor, calling the setup-context prop signal with an argument
  throws an error naming the tag and the prop and telling the author to
  emit an event instead. This applies in all builds.
- Unbound props stay writable by their own component. Assigning to the
  host's accessor from outside (the parent's "state down" path) is
  unchanged. Attribute changes while bound stay ignored, as today.
- The glossary entry for **Prop** and ADR-007 record that a bound prop
  is read-only inside the component.

### Typed binding (finding 14)

- Core gains a small exported helper that binds a signal to a named
  prop of a host, typed so the signal's value type must match the prop
  type. It is equivalent to assigning the signal to the accessor. The
  example's Counter uses it in place of the double cast.
- Attribute staleness after binding stays as documented in the
  glossary. Reflecting bound values to attributes is out of scope.

### Markup identity (finding 12)

- Both templaters brand `Markup` with a registry symbol
  (`Symbol.for('microtags.markup')`) and check the brand instead of
  `instanceof`. Markup from another copy of the package is then
  recognised and rendered normally rather than escaped. This lets the
  AGENTS.md note about two copies in `test/index.ts` be relaxed, but
  tests may keep importing `mount` from the package.

### Example app (findings 6, 7, 10, 11, 15)

- `createApp` loses the server-only index page options. Any value a
  page function reads comes from `AppState` and is serialized. Tests
  that set those options switch to state.
- The `reduce-fouce` class, its CSS rule, and the client helper that
  removes it are deleted. Adoption creates no elements, so there is no
  flash to hide.
- Badge's setup writes its text only when the current text differs from
  the label, and the example README's component notes describe that
  pattern for any setup that writes server-rendered content.
- A request path outside the prefix is given the not-found route, so it
  renders the not-found page with a 404.
- `/index.html` under the prefix maps to route `/`, so the nav marks
  the home link as current.
- Evaluation order after cascade (finding 13): the client entry imports
  leaf components (Badge, Notice) before components that nest them, and
  the example README notes why. The cascade's import handling is not
  changed.

### Server-render code out of core's define path (finding 8, goal 5)

This is the one architectural change, recorded as ADR-009 ("Server
render support loaded through the render link"). It amends ADR-005,
whose consequences claim that a browser bundle holds hydration code
only.

- Today `withProps` computes a serializer for every prop, and `setup`
  installs the component's `render` static, which closes over the
  host-tag builder, the serializers and attribute escaping. All of it
  is reachable from `define()`, so the bundler cannot drop it.
- After the change, the host-tag builder, the serializers and attribute
  escaping live in a separate server render support module. Core
  records prop metadata (kind and coercer) and the render function,
  and installs on the class a minimal `render` static that delegates to
  the support module once the support module has registered itself.
  Calling `render` before registration throws an error that names the
  module to import.
- The support module is registered by the server templater, by the
  browser templater when it creates a host, and by the `microtags/build`
  transform. The transform injects an import of the support module into
  any client module where it keeps a render link. Code that calls a
  component's `render` static directly, without the templater, imports
  the support subpath once. This is a breaking change for that path. It
  is acceptable at 0.0.x and is documented in the README.
- The exact registration mechanism (a side-effect subpath, a setter
  exported from core, or a module-level hook) is settled by the first
  ticket, which prototypes it and measures before any other ticket in
  this section lands. The constraint is fixed: with every render link
  stripped and no templater import, the bundle contains none of the
  host-tag, serializer or escaping code.
- AGENTS.md's "Builder and serialization" section says the serializer,
  escape function and host-tag wrapper must live in core. It is
  rewritten to describe the new split, and the rule for new coercer
  types now points at the support module.
- The core size budget is lowered to the new measured size rounded up
  to the next 0.05 kB, and ADR-009 records the number. ADR-005's "core
  budget stays at 3.5 kB" gets a note pointing to ADR-009. ADR-007's
  claim that core grows "only by the prop accessors" is corrected.
- The example keeps Badge and Notice, so its client still ships the
  support module. The measurable win is for apps that strip every
  render link. ADR-009 states this plainly.

### Browser templater budget

- Findings 3, 4, 9 and 12 add code to the browser templater, which is
  at 4.56 kB of its 4.6 kB limit. The earlier spec waived strict limits
  for the templater subpath. If the limit has to rise, the new limit is
  the measured size rounded up to the next 0.05 kB and is recorded in
  ADR-007's note.

### Docs that contradict the code

All six contradictions listed in the review are fixed, either by the
code changes above (AGENTS.md and the example README on the config
import; ADR-007 on adoption attributes) or by notes and corrections
(ADR-005 on bundle contents and budget; ADR-007 on core growth and
mismatch warnings). `toc:hydration` is re-run after the README changes.

## Testing Decisions

A good test here drives the public surface (`html`, `raw`, `mount`,
`define`, the build plugins, `app.request`, a real browser page) and
asserts on what a user or crawler could observe: emitted HTML, DOM
mutations, bound listeners firing, response status and body, thrown
errors, bundle contents and size. Tests do not reach into private
helpers such as `_adopt`, `_range` or `_renderHost`. Per the global
rules, tests do not assert on specific text content in HTML. The SSR
suite's exact-string assertions for byte-identical static output are
an existing, deliberate exception and stay.

Seams, all existing suites (confirmed with the maintainer):

1. SSR suite (`npm run test:ssr`, Node, no DOM): server attribute
   serialization (escaped once, boolean and null rules, host non-prop
   attributes), the children marker on component children, and
   byte-identical static pages. It also runs the parity table below.
2. Browser suite (`npm test`): `mount` and adoption. A MutationObserver
   attached before `mount` asserts no attribute mutations on adopted
   static attributes, and none for bound attributes whose values
   already match. Fixtures are built from static HTML with markers via
   `innerHTML`, as existing adoption tests do. It covers a multi-node
   `raw()` followed by a button whose listener fires, a kept component
   with a region before its children whose child listener fires,
   mismatch lookahead leaving later siblings bound, a write to a bound
   prop throwing, the typed binding helper, and markup from a second
   copy mounting as elements. It also runs the parity table below
   against the browser `String()` output.
3. Hydration suite (`npm run test:hydration`, `app.request` against the
   built app): a path outside the prefix returns 404 with the not-found
   page's route in the serialized state, `/index.html` marks the home
   link current (asserted by attribute, not text), and the example
   builds. `test:hydration-dev` and the listener test must pass again.
4. Playwright e2e (`npm run test:e2e`): with every `.js` request
   aborted, the document is visible (computed opacity is not 0) after
   load. On `/list`, a MutationObserver started at `interactive` sees
   no text replacement inside badges and no attribute writes during
   hydration.
5. Bundle size (`npx size-limit`) and the plugins suite
   (`npm run test:plugins`): a fixture whose render links are all
   stripped is bundled, and the output contains none of the
   server-render code. This is checked through an observable property
   of the bundle (for example its size against a stripped-and-unused
   baseline, or the absence of the support module in the bundler's
   metafile), not through minified identifier names. A fixture with a
   kept render link gets the injected support import. Core's
   size-limit entry is lowered as decided above.

Parity table: a single list of `(markup input, expected HTML)` cases,
shared by the SSR and browser suites, covering `&`, quotes and `<` in
plain and host attributes, `true`, `false`, `null` and `undefined`
values, and nested markup. The server output for each case must equal
the browser `String()` output, apart from region and children markers,
which the browser `String()` path never emits. The table is the
contract for user story 5.

Type tests in `test/types.ts` cover the binding helper's signature,
including that a mismatched signal type does not compile.

Prior art: existing exact-string SSR cases in `test/ssr.ts`; adoption
fixtures built with `innerHTML` and markers in `test/index.ts`;
`app.request` route tests in `test/hydration.ts`; the `.js`-aborted
host count in `test/e2e/hydration.spec.ts`; stripping fixtures in
`test/fixtures/` driven by `test/plugins.ts`.

## Out of Scope

- A dev/production flag for the library. Warnings stay unconditional.
- Warning when adopted text differs from the markup (the review's
  optional part of finding 6). Removing server-only inputs removes the
  known cause.
- Reflecting bound prop values back to host attributes.
- Changing the cascade to keep side-effect imports (finding 13 is
  handled by import order and docs).
- Not emitting `key` as a DOM attribute. The browser morph reads keys
  back from the attribute, so it is load-bearing.
- Committing a lockfile. Whether this library pins dependency versions
  is a separate maintainer decision.
- Shrinking the browser templater's own `String()` path. Kept
  components need it to create hosts.

## Further Notes

- Suggested order: finding 1 first, because every hydration and e2e
  seam is red until it lands. Then the parity work (finding 2), the
  adoption changes (findings 3, 4, 9, 12), props (5, 14), the example
  (6, 7, 10, 11, 15 and 13), and the core restructure last, starting
  with its prototype-and-measure ticket. Docs fixes ride with the
  ticket that makes each one true.
- The children marker change alters server output for components with
  non-empty children. Those outputs were never byte-identical static
  pages, but the browser adoption fixtures and the SSR children
  assertions both need updating in the same ticket.
- Measurements to repeat at the end, using the review's method: core,
  `microtags/htm` and browser templater sizes; the example client with
  stripping on and off; and a fixture app with every render link
  stripped.
