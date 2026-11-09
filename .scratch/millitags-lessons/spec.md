# Lessons from millitags: templater guards, control bindings, host moves, gates

**Status:** ready-for-agent

**Date:** 2026-10-14

Source: a comparison of this branch (`wip-adding-hono-to-hydration-example`
at b95c4df) against the sibling repo `../millitags/`, which explored the
same server render plus hydration idea further and later converged on the
state design this repo already has (its ADR-007 removed per-component
state bags). Nothing of its architecture is ported. The nine items below
are the specific lessons it learned the hard way, each confirmed against
this repo's source before being written down.

This spec follows `.scratch/hydration-dx-fixes/spec.md`, which is
`ready-for-agent` and not yet implemented. Where the two touch the same
code the decisions here are written against that spec's end state, and
the Further Notes say which tickets must land after it. No ADR is
superseded. ADR-008 gains a note.

## Problem Statement

An app author writing page markup with the templater can make two
mistakes that produce silently wrong HTML. An unclosed void element such
as `<input type="text">` makes `htm` treat everything after it as the
input's children, and both the server and the browser templater throw
those children away, so the rest of the form vanishes with no error. A
spread of an object whose key is not a valid attribute name writes that
key straight into the tag, so `x" onload="..."` breaks out of the
attribute on the server, and on the browser `setAttribute` throws.

In the browser, a signal bound to an input's `value` writes the
attribute, which stops affecting the field once the user has typed in
it, so the field and the state drift apart. A checkbox's `checked` has
the same problem.

A host that the morph moves with `insertBefore`, because the browser has
no `moveBefore`, is disconnected and reconnected in one tick. Its setup
cleanups run and setup runs again, so any state the component kept in
its setup is lost on every reorder in those browsers. Two siblings with
the same `key` are matched silently, so a list bug shows up as a wrong
node rather than an error.

For the maintainer, verifying the repo takes eight `npm run` commands
in an order only AGENTS.md knows, and the only proof that stripping
keeps markup out of the client bundle is a runtime assertion that one
component's render static is undefined. Nothing checks the built
assets, and nothing proves a check could fail. The README has one
sentence on escaping and does not say what escaping cannot protect
against. ADR-008 records the cost of carrying state twice as a
trade-off without the numbers that make it a known, bounded cost.

## Solution

Both templaters throw when a void element has children, naming the tag
and the self-closing form. Both templaters and the host tag serializer
skip an attribute whose name is not a valid HTML attribute name, so a
spread of untrusted keys cannot break out of a tag.

The browser templater writes `value`, `checked` and `selected` on form
controls as DOM properties, and only when the bound value changed since
the last write, so an unrelated re-render never overwrites what the
user typed, and a changed bound value always wins.

A host whose disconnect is followed by a reconnect in the same tick is
not torn down and does not run setup again. The morph's `moveBefore`
call is guarded so an unexpected throw falls back to `insertBefore`. A
duplicate `key` among the items of one reactive region throws.

One `gate` script runs every check in cost order. The hydration suite
gains a built-asset isolation check with positive controls: fixed
strings from stripped markup and from server-only code must be absent
from the client assets, and each string is first proven present in the
server build, so a passing result cannot be vacuous. The README gains a
section on what escaping does not cover, and ADR-008 records the
measurements behind its trade-off.

## User Stories

1. As an app author, I want an unclosed void element to throw with a
   message naming the tag and the self-closing form, so that a missing
   `/>` cannot silently delete the rest of my page.
2. As an app author, I want a spread of attributes with an invalid key
   to skip that key on both sides, so that user data in a spread
   cannot break out of a tag or crash `mount`.
3. As a site visitor, I want text I typed into a bound input to survive
   an unrelated re-render, so that the page does not undo my edits.
4. As an app author, I want a changed bound value to update a form
   control even after the visitor has typed in it, so that state down
   still works for inputs.
5. As a site visitor, I want a reordered list to keep each component's
   state in every browser, so that a counter in a moved row does not
   reset.
6. As an app author, I want a duplicate `key` among siblings to throw,
   so that a list bug fails at the source rather than showing the wrong
   node.
7. As a maintainer, I want one command that verifies the repo, so that
   I do not have to remember eight scripts and their order.
8. As a maintainer, I want the hydration suite to prove that stripped
   markup and server-only code are absent from the built client assets,
   with a positive control for each marker, so that a passing check
   means something.
9. As an app author, I want the README to say what escaping does not
   protect against, so that I validate URL schemes and never put user
   data inside `raw`, `<script>` or `<style>`.
10. As a future maintainer, I want ADR-008 to carry the measurements
    behind "state is duplicated in the payload and the HTML", so that
    the trade-off is a known cost rather than a vague one.

## Implementation Decisions

### Void elements with children throw (item 1)

- The check lives in `h` of both the server templater and the browser
  templater, since every template passes through it. When the tag is in
  the void set and any child is present, including whitespace text, `h`
  throws an error naming the tag and the self-closing form, and saying
  that an unclosed void element swallows what follows it.
- The void set stays as it is in both templaters. The two sets must
  stay identical; the parity table from the hydration DX spec is the
  place that proves it.
- The README paragraph on void elements changes from describing the
  swallowing to saying the templater throws.

### Attribute names are validated (item 2)

- A valid attribute name matches the HTML attribute grammar as millitags
  encodes it: first character a letter, `_` or `:`, then letters,
  digits, `-`, `_`, `:` or `.`. Anything else is skipped silently, on
  both templaters and in the host tag serializer. Skipping rather than
  throwing is deliberate: the realistic source of a bad key is user data
  in a spread, which should not crash a request.
- The hydration DX spec moves the host tag serializer out of core's
  define path. The validation goes wherever that serializer lives after
  that spec lands, so this item's serializer ticket is blocked by it.
- The key `key` is not an attribute name problem and is unchanged.
- The README's new escaping section (item 8) states the rule.

### Form controls bind DOM properties (item 3)

- In the browser templater, `value`, `checked` and `selected` on
  `input`, `textarea`, `select` and `option` are control properties.
  They are written as DOM properties, never as attributes, on create,
  on patch and on adopt. All other attributes are unchanged.
- A per-element record holds the last value each control property was
  bound to. A write happens only when the bound value differs from the
  recorded one by `Object.is`. `value` writes `''` for `null` and
  `undefined` and the string form otherwise; `checked` and `selected`
  write the boolean form.
- On adopt the first comparison is against the live DOM property, not
  the record, so an adopted control whose server attribute already
  matches gets no write. This keeps the hydration DX spec's passive
  adoption rule.
- For `select`, the `value` property is written after the element's
  children exist, since assigning it before the options are present
  does nothing. The create path orders children before control
  properties for that element.
- The server templater and the browser `String()` path still emit these
  as attributes in static HTML; the property rule applies only to live
  DOM.

### Hosts survive moves; moveBefore is guarded (item 4)

- A host tracks whether it is live: connected and not torn down. The
  connected callback returns early when the host is already live, so a
  reconnect before teardown never runs setup twice.
- The disconnected callback queues a microtask. When it runs, teardown
  happens only if the host is still not connected. Teardown runs the
  setup cleanups once and marks the host not live; a second queued
  microtask for a host that is already torn down does nothing.
- This changes the observable timing of cleanup: after a removal,
  cleanups run on the next microtask, not synchronously. Existing tests
  that assert cleanup right after `remove()` await a microtask first.
  The glossary entry for **Setup** and the README's lifecycle section
  say cleanup happens after a microtask, so a move keeps state.
- `connectedMoveCallback` stays empty, so browsers with `moveBefore`
  still skip the callbacks entirely.
- The morph's move step calls `moveBefore` only when the parent is
  connected, inside a try, and falls back to `insertBefore` if it
  throws.
- With both in place a reorder keeps host state in every browser.

### Duplicate render keys throw (item 5)

- When the morph collects the keys of a region's new items and sees a
  key twice, it throws an error naming the key. The check is on the new
  items, not on existing DOM, so server HTML with repeated keys fails on
  the first morph of that region, which is the first time the morph
  reads them.

### One gate script (item 6)

- `npm run gate` runs, in order: remove the example build directory
  (ESLint lints it if present), lint, typecheck, build, size, the
  browser suite, the SSR suite, the build suite, the plugins suite, the
  CLI suite, the hydration suite, and the hydration dev-server test.
  Cheapest first; the hydration suite last because it builds the
  example.
- Playwright is not in the gate because it needs a one-time browser
  install. The script's README entry says to run `test:e2e` separately.
- AGENTS.md's note that both suites must stay green points at `gate`.

### Built-asset isolation check with positive controls (item 7)

- The check is added to the hydration suite, which already runs after
  `build:hydration` and reads the build directory. It reads every
  JavaScript asset under the client build and the server build.
- A marker table pairs each forbidden fixed string with the built
  server file that proves the string survives bundling. Three markers:
  a string from the stripped Counter's markup (the component's render
  output, chosen from its template, never from text that also appears
  in kept components or library error messages); a string from the
  scaffold module (the page marker comment) proving server app code is
  absent; and a string from the build entry's error text proving the
  TypeScript transform is absent. Markers are matched as fixed strings,
  never regexes.
- For each marker the positive control runs first: the string must
  appear in its control file, or the test fails saying the marker is
  stale. Only then is every client asset asserted to lack it. Each file
  is reported separately so a zero count is never confused with a
  failed read.
- Badge and Notice are kept components whose markup ships by design;
  their strings are not markers. The comment on the table says so, and
  says that when the Counter markup changes the marker changes in the
  same commit.

### README: what escaping does not cover (item 8)

- A subsection under the templater docs, in the voice of the existing
  README, lists: `javascript:` and other URL schemes are not made safe
  by attribute escaping, validate the scheme; HTML escaping inside
  `<script>` and `<style>` is wrong for those contexts; `raw` skips
  escaping by construction and never takes user data; attribute names
  that are not valid are skipped. It also states the void element rule
  from item 1.
- `npm run toc` is re-run. No em dashes, no arrow characters.

### ADR-008 note with measurements (item 9)

- A dated note is appended to ADR-008, not a change to its decision. It
  records the measurements millitags took on 2026-08-18 with its
  toolchain, attributed as such: fifty rendered items as HTML alone,
  as a JSON payload alone, and as both, brotli, where the compressor
  recovered about eight percent of the duplicated data; and the brotli
  import cost of library deserializers (devalue, turbo-stream, seroval,
  flatted) against `JSON.parse`, each larger than a hand-written
  reviver and the first three more than half of a core bundle. The
  note states the conclusion the numbers support: the payload stays
  narrow and `JSON.parse` stays the reviver, which is what ADR-008
  already decided.

## Testing Decisions

A good test drives the public surface (`html`, `raw`, `mount`, `define`,
`app.request`, the built assets on disk) and asserts what an author or
visitor could observe: a thrown error, emitted HTML, a DOM property, a
listener firing, host setup counts, bundle contents. Tests do not reach
into private helpers. Per the global rules, tests do not assert on
specific text content in HTML and there are no tests for docs; items 6,
8 and 9 have no tests. Error messages are asserted by a stable fragment
such as the tag name, not by the full sentence.

Seams, all existing suites (confirmed with the maintainer):

1. SSR suite (`npm run test:ssr`, Node, no DOM): `html` with an
   unclosed void element throws naming the tag; a self-closed one does
   not. A spread containing an invalid key emits no attribute for it
   while valid keys in the same spread are emitted. A component's host
   tag given an invalid non-prop attribute name omits it. Static pages
   stay byte-identical.
2. Browser suite (`npm test`): the browser `html` throws on a void
   element with children; `mount` with a spread holding an invalid key
   does not throw and the element has no such attribute. For controls:
   a bound `value` is a property, so a user edit (set `value` then
   dispatch `input`) survives a re-render of an unrelated signal, and a
   changed bound value wins after an edit; the pair must be tested
   together because the first can pass by accident. The same pair for
   `checked`. A `select` created with a bound `value` selects the
   matching option. An adopted input whose attribute already matches
   gets no property write (a MutationObserver sees nothing, and a
   dirty value is untouched). For moves: shadow `moveBefore` with
   `undefined` on the parent instance (the millitags technique for
   Chromium, which has it), reorder a keyed list of hosts, and assert
   setup ran once per host and host state survived; after a real
   removal, `await Promise.resolve()` and then assert cleanup ran.
   Give each test its own tag name since definitions are global to the
   page. Duplicate keys in one region throw naming the key. Existing
   disconnect tests are updated to await the microtask.
3. Hydration suite (`npm run test:hydration`): the isolation check as
   decided above. To prove the check can fail, one test builds a
   marker from a kept component's markup and asserts it is found in a
   client asset, which is the inverse of the forbidden assertion and
   shows the scan reads the right files.

Prior art: the void-element case in `test/index.ts` ("void elements emit
no closing tag"); region and adoption tests in `test/index.ts` that build
fixtures with `innerHTML` and markers; the `ctx.bind` checkbox test for
the property-versus-attribute pattern; `app.request` tests and the built
app import in `test/hydration.ts`; the hostile-key check in millitags'
`src/safe.ts` and its isolation gate in
`scripts/check-example-isolation.ts` for the positive-control shape.

## Out of Scope

- Porting any millitags architecture: per-component state payloads,
  automatic per-page script delivery, the client router, server-driven
  patches. Per-page delivery may get its own ADR later.
- A library dev flag. Errors and warnings stay unconditional.
- Keeping keys off the DOM. The morph reads keys back from the `key`
  attribute, so it stays, as the hydration DX spec already decided.
- Validating keys of declared props. They come from the builder chain,
  not from data.
- Reusing listeners by identity across region runs, as millitags does.
  The region re-binds on each run today and that is not a bug.
- Patching `raw()` content in place across region runs. It is
  re-created today; rare enough to leave.
- Adding Playwright to the gate.

## Further Notes

- Blocked by the hydration DX spec: the host tag serializer part of
  item 2 (the serializer moves), the adopt part of item 3 (passive
  adoption), and the isolation markers if that spec changes the
  Counter's markup. Everything else can land first.
- Suggested order: item 1, item 2 (templaters first, serializer after
  the DX spec), item 5, item 4, item 3, then items 6 and 7, then the
  docs items 8 and 9.
- Item 4 changes cleanup timing for every host, including the core
  example and the hydration example. Run the full gate after it, and
  check the browser templater and core size entries; if either limit
  must rise, the new limit is the measured size rounded up to the next
  0.05 kB, recorded in the size file's comment.
- Millitags' AGENTS.md warns that port 8123 is shared by every tapout
  run on the machine, so `EADDRINUSE` during the browser suite means
  another worktree is testing; retry.
