<!-- nightralph:entry ticket=millitags-lessons:1 attempt=1 outcome=done -->
## 2026-10-14 21:02 -- millitags-lessons/01 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.87. Checked items: "SSR suite: `html` with an unclosed void element that has children throws, and the error message contains the tag name.", "SSR suite: `html` with the same void element self-closed does not throw and emits no closing tag (existing behaviour kept).", "SSR suite: static pages used by the exact-string assertions stay byte-identical.", "Browser suite: the browser `html` throws on a void element with children, and the error message contains the tag name.", "Browser suite: `mount` of markup with self-closed void elements still creates them (existing void-element test still passes).".

### Agent notes
# Ticket 01: void elements with children throw

Implemented:
- src/htm.ts: `_checkVoid` called at the top of `h`; throws
  "<tag> has children: an unclosed void element swallows what follows
  it. Write it as <tag />." when a VOID tag gets any child.
- src/htm.browser.ts: same check inline in `h` (separate bundle, so the
  check is duplicated rather than imported, like VOID itself).
- README "Void elements" paragraph now says the templater throws.
- AGENTS.md: note on the check and on awaiting tapzero `t.throws`.

Tests:
- test/ssr.ts: unclosed input with children throws (/input/), whitespace
  child under <br> throws (/br/), self-closed input keeps following
  content. Existing exact-string static page test still passes.
- test/index.ts: browser `html` throws (/input/); new mount test for
  self-closed input/br (there was no existing browser mount void test,
  only a server `html` one, so I added one; it passed before the change,
  as a characterization test).

Readings:
- "whitespace counts as a child": any child at all triggers the throw.
- README item had no test (docs).

Gotchas:
- Fresh worktree needs `npm run build` before `npm test` (typecheck
  resolves microtags via dist).
- tapzero `t.throws` is async; must be awaited.
- Port 8123 EADDRINUSE from other worktrees; retry loop works.
- example/ssr.ts has `<meta charset>` unclosed but in a plain string,
  not `html`, so unaffected.

---
<!-- nightralph:entry ticket=millitags-lessons:3 attempt=1 outcome=tests -->
## 2026-10-14 21:05 -- millitags-lessons/03 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.75. Checked items: "SSR suite: static pages stay byte-identical.".

Test gate failed.
Last 40 lines of `03-host-tag-serializer-skips-invalid-attribute-names.test.log`:
```

> microtags@0.0.14 test
> npm run typecheck && esbuild --bundle --loader:.css=empty ./test/index.ts | tapout


> microtags@0.0.14 typecheck
> tsc --noEmit -p tsconfig.typecheck.json

node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use :::8123
    at Server.setupListenHandle [as _listen2] (node:net:2008:16)
    at listenInCluster (node:net:2065:12)
    at Server.listen (node:net:2170:7)
    at runTestsInBrowser (file:///Users/nick/code/microtags.millitags-lessons-03-host-tag-serializer-skips-invalid-attribute-names/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.millitags-lessons-03-host-tag-serializer-skips-invalid-attribute-names/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:2044:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '::',
  port: 8123
}

Node.js v25.8.2
```

### Agent notes
# Notes: 03 host tag serializer skips invalid attribute names

## Blocker status
The hydration DX spec (ticket 13, server render support module) has NOT
landed: progress.md shows every DX ticket unchecked and `_renderHost`
still lives in `src/builders.ts`. The ticket says to put the check
"in whichever module then holds the serializer", so it went into
`src/builders.ts` (`_attrName` regex + `continue` in `_renderHost`'s
extra-attrs loop). When DX ticket 13 moves `_renderHost`, the regex and
the check must move with it; the SSR tests drive `El.render` so they
keep working unchanged.

## Item 1
- Test: `render: host tag skips extra attributes with invalid names`
  in test/ssr.ts. Red (3 fails), then green.
- Grammar: `^[a-zA-Z_:][-a-zA-Z0-9_:.]*$` per spec item 2. Ticket 02
  (templaters) has not landed either, so there is no shared helper yet;
  02 may want to share this grammar (core must stay htm-free, so the
  templaters would need their own copy or import from a shared util).

## Item 2
- Test: `render: declared props serialize unchanged, names unvalidated`.
  Regression guard with an exact host-tag string (number, bare boolean,
  escaped string, escaped json) and a declared prop `$odd` whose name is
  outside the grammar. Passed immediately; proved it can fail by
  temporarily validating declared names too (went red), then reverted.

## Item 3
- No new test: `html SSR: static page output is unchanged` (exact
  strings) already covers it and still passes.

## Size
- The first regex pushed core to 4.22 kB (limit 4.2 kB; baseline before
  the change was 4.17 kB). Shortened to the equivalent
  `/^[a-z_:][-\w:.]*$/i`, which brings it to 4.19 kB. Limit unchanged.
  Core has about 10 B of headroom left, so later tickets (05 host moves)
  will probably need to raise it.

## Final gate
- lint clean, test:ssr 86/86, npm test 286/286.
- AGENTS.md: added a note on `_attrName` and on core size headroom.

---
<!-- nightralph:entry ticket=millitags-lessons:2 attempt=1 outcome=done -->
## 2026-10-14 21:06 -- millitags-lessons/02 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.15. Checked items: "Browser suite: a signal-valued attribute with an invalid name is never written on re-render.".

### Agent notes
# Ticket 02: templaters skip invalid attribute names

Valid name regex: /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/ (`_ATTR`), duplicated
in src/htm.ts and src/htm.browser.ts (each entry is standalone).

1. SSR plain element spread: done (src/htm.ts, test/ssr.ts).
2. SSR component extra attrs: done; filtered before `attrs` is passed to
   render, so the host tag serializer never sees it.
3. SSR static pages byte-identical: covered by the existing
   "static page output is unchanged" test, which still passes; no new
   test needed.
4. Browser spread: done. Guards in `_compArgs`, `_str` and `_bindEl`
   (create, patch and adopt all go through `_bindEl`). Guarding in
   `_bindEl` rather than `_setAttr` means no effect is created for an
   invalid signal-valued attribute. `_bindHost` only writes `key`.
5. Browser signal attribute with invalid name: test written after the
   guard existed; verified it fails (setAttribute throws) with the
   `_bindEl` guard removed and passes with it.

Size: browser templater went 4.56 -> 4.62 kB with the long regex, over
the 4.6 kB limit. Shortened to the equivalent `/^[a-z_:][-\w:.]*$/i`
in both templaters; now 4.6 kB, exactly at the limit with no headroom.
Limit not raised. Later tickets touching htm.browser.ts will likely
need to raise it (spec: measured size rounded up to next 0.05 kB).

Tests: npm test 294/294, test:ssr 82/82, lint clean, size passes.

---
<!-- nightralph:entry ticket=millitags-lessons:3 attempt=2 outcome=done -->
## 2026-10-14 21:08 -- millitags-lessons/03 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $0.78. Checked items: "SSR suite: declared props with the same values serialize exactly as before.", "SSR suite: static pages stay byte-identical.".

### Agent notes
# Notes: 03 host tag serializer skips invalid attribute names (attempt 2)

Attempt 1 failed only on EADDRINUSE :8123 (another worktree running
tapout); its commits were not kept, so the work was redone.

## Blocker status
DX ticket 13 (server render support module) has not landed;
`_renderHost` still lives in `src/builders.ts`, so the check went there
(`_attrName` regex + `continue` in the extra-attrs loop). When ticket 13
moves `_renderHost`, move the regex with it. SSR tests drive
`El.render`, so they survive the move unchanged.

## Item 1
- Test `render: host tag skips extra attributes with invalid names`
  (test/ssr.ts). Red (2 fails) then green.
- Grammar `/^[a-z_:][-\w:.]*$/i` (equivalent to the spec's grammar,
  shorter for core's size budget).

## Item 2
- Test `render: declared props serialize unchanged, names unvalidated`:
  exact host-tag string (number, bare boolean, escaped string, escaped
  json, declared `$odd` outside the grammar, a valid extra attr).
  Passed immediately (regression guard); proved it can fail by
  temporarily validating declared names too (went red), then reverted.

## Item 3
- No new test: `html SSR: static page output is unchanged` (exact
  strings) already covers it and passes.

## Final gate
- lint clean, test:ssr 82/82, npm test 286/286 (first run hit
  EADDRINUSE :8123 from another worktree; a retry loop passed).
- Size: core 4.19 kB / 4.2 kB limit, unchanged limit. About 10 B of
  headroom left; ticket 05 (host moves) will likely need to raise it.
- AGENTS.md: note on `_attrName`, moving it with `_renderHost`, and
  core size headroom.

---
<!-- nightralph:entry ticket=millitags-lessons:4 attempt=1 outcome=done -->
## 2026-10-14 21:09 -- millitags-lessons/04 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.00. Checked items: "Browser suite: with the parent's `moveBefore` shadowed by a function that throws, a keyed reorder still produces the new order.", "Browser suite: with the parent's `moveBefore` shadowed by `undefined`, a keyed reorder still produces the new order.".

### Agent notes
# Ticket 04 notes

## Item 1: duplicate keys throw (done, commit 1923c85)
- `_morph` in src/htm.browser.ts tracks a `seen` set while walking the
  new items; a repeated key throws `duplicate key "<k>"` before any DOM
  change. Existing DOM is not checked (per spec).
- Tests: two in test/index.ts -- initial mount and a later update.
  The effect error propagates out of both `mount` and the signal write.

## Item 2: distinct keys still morph
- No new code; covered by existing keyed tests ("reordering a keyed list
  moves the same nodes", "adding and removing keyed items", "a host in a
  keyed list keeps identity on reorder"), which pass after item 1.

## Items 3 and 4: moveBefore guarded (done, commit 5fd6012)
- Placement loop in `_morph`'s `_dom` block: `moved` is true for kept
  nodes when `parent.isConnected`; `p.moveBefore!(n, ref)` runs inside a
  try (a missing moveBefore throws TypeError, caught); otherwise or on
  throw, `insertBefore`. `insertBefore` errors are never swallowed.
- Tests shadow `moveBefore` on the `ul` instance via
  `Object.defineProperty` (throwing fn, and `undefined`), with the box
  attached to `document.body` so the connected path is exercised.
- The `undefined` test passed before the change (old code already fell
  back when moveBefore was falsy); kept as a regression guard. The
  throwing test was red before the guard.
- Size: browser templater went 4.6 kB -> 4.61 kB; limit raised to
  4.65 kB per the spec rule, with a comment in .size-limit.js. Tried
  smaller variants: `throw 0` sentinel fails lint (no-throw-literal);
  wrapping both calls in one try would retry a failing insertBefore;
  `seen.size === seen.add(k).size` was bigger under brotli.
- AGENTS.md: added a note under the browser templater section.
- Final `npm test`: 297/297 pass. Lint clean.

---
<!-- nightralph:entry ticket=millitags-lessons:5 attempt=1 outcome=done -->
## 2026-10-14 21:10 -- millitags-lessons/05 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.44. Checked items: "Browser suite: with the parent's `moveBefore` shadowed by `undefined`, reordering a keyed list of hosts through a region runs setup once per host and a signal created in setup keeps its value after the reorder.", "Browser suite: moving a host with `insertBefore` directly, then awaiting a microtask, runs no cleanups.", "Browser suite: after a real removal and `await Promise.resolve()`, cleanups have run exactly once.", "Browser suite: removing a host twice before the microtask runs the cleanups once.", "Browser suite: reconnecting a host after its teardown runs setup again (the existing second-connect behaviour still holds).", "All existing disconnect and cleanup tests pass after awaiting a microtask.", "`npm run size` passes, with any raised limit recorded in the size file's comment.".

### Agent notes
# Ticket 05: hosts survive same-tick moves

## Implemented
- src/factory.ts: `_live` field; `connectedCallback` returns early when
  live; `disconnectedCallback` queues a microtask that tears down only if
  still disconnected and still live (so a second queued task is a no-op).
  `connectedMoveCallback` unchanged (empty).
- test/index.ts: new tests (region reorder with `moveBefore` shadowed,
  direct insertBefore move, removal runs cleanups once, remove twice in
  one tick, reconnect after teardown). Existing disconnect tests now
  `await Promise.resolve()`.
- README `builder.setup` section + ctx methods table, CONTEXT.md Setup.
- AGENTS.md: "Host teardown" section.

## Decisions / readings
- "Removing a host twice before the microtask" read as remove, append,
  remove (a literal second `remove()` is a no-op with no parent).
- The two throwing-cleanup tests used to call `disconnectedCallback()`
  directly and catch the sync throw. Teardown now runs in a microtask,
  so the throw becomes an uncaught error, and tapout's runner fails the
  whole run on any window `error` event (a capture-phase listener with
  stopImmediatePropagation did not prevent it -- tested). The tests now
  use a `catchTeardown` helper that swaps `window.queueMicrotask` while
  the host is removed, runs the queued tasks, and returns the first
  error. Same assertions as before (remaining cleanups run, first error
  surfaces). Couples the test to `queueMicrotask`, which the spec names.
- Size: no limit change needed (core 4.2 kB / 4.2 kB limit, browser
  htm 4.56 kB / 4.6 kB). Core is right at its limit.
- Docs (README, CONTEXT.md) skipped test-first per rules.

## Suites
- Green: `npm test` (297), test:ssr (79), test:build, test:plugins,
  test:cli, lint, typecheck, size.
- `test:hydration` and `test:hydration-dev` fail in this environment
  before any test runs: loading example-hydration/vite.config.ts throws
  `microtags/build requires "typescript" as a peer dependency` (the ESM
  dist/vite.js has no `require`). This happens at config load, which
  never touches src/factory.ts, so it predates this ticket and is not
  caused by it. Not fixed (out of scope).

---
<!-- nightralph:entry ticket=millitags-lessons:11 attempt=1 outcome=tests -->
## 2026-10-14 21:10 -- millitags-lessons/11 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.51. Checked items: "ADR-008 ends with a dated note attributing the measurements to millitags and its toolchain, giving the three brotli sizes and the recovered fraction, and the deserializer import costs against `JSON.parse`.", "The note states the conclusion and leaves the Decision, Trade-offs and Consequences sections unchanged.", "The note contains no em dashes and no arrow characters.".

Test gate failed.
Last 40 lines of `11-adr-008-note-with-measurements.test.log`:
```

> microtags@0.0.14 test
> npm run typecheck && esbuild --bundle --loader:.css=empty ./test/index.ts | tapout


> microtags@0.0.14 typecheck
> tsc --noEmit -p tsconfig.typecheck.json

node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use :::8123
    at Server.setupListenHandle [as _listen2] (node:net:2008:16)
    at listenInCluster (node:net:2065:12)
    at Server.listen (node:net:2170:7)
    at runTestsInBrowser (file:///Users/nick/code/microtags.millitags-lessons-11-adr-008-note-with-measurements/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.millitags-lessons-11-adr-008-note-with-measurements/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:2044:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '::',
  port: 8123
}

Node.js v25.8.2
```

### Agent notes
# Ticket 11: ADR-008 note with measurements

- Implemented: appended a dated "Note (2026-10-14)" section to
  docs/adr/ADR-008-serialized-server-state.md. Decision, Trade-offs and
  Consequences unchanged. INDEX.md unchanged.
- Source of figures: ../millitags/docs/adr/ADR-005-inline-markup-and-
  route-bundles.md, section "The narrowed serialization payload"
  (measured 2026-08-18), plus ../millitags/src/revive.ts header. The
  ticket explicitly named ../millitags as the source, so it was read
  (read-only) despite the general "stay in the worktree" rule; nothing
  outside the worktree was modified.
- Figures copied: HTML 509 B, payload 496 B, both 967 B brotli, 7.7%
  recovered; devalue 1959, turbo-stream 2477, seroval 3425, flatted
  377, JSON.parse 32 bytes brotli; millitags core 3519; hand-written
  reviver under 250 bytes.
- Reading of "first three more than half of a core bundle": against
  millitags' own core (3519 B), as the source states.
- No tests: docs-only, per the global rule. Checked no em dashes or
  arrows. npm test: 286/286 pass. Lint not relevant (markdown only).
- No AGENTS.md learning worth adding.

---
<!-- nightralph:entry ticket=millitags-lessons:6 attempt=1 outcome=done -->
## 2026-10-14 21:10 -- millitags-lessons/06 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.24. Checked items: "Browser suite, one test: the same pair for a checkbox's `checked`, where the visitor toggles it, an unrelated re-render leaves it, and a changed bound value wins.", "Browser suite: a `select` created with a bound `value` has the matching option selected immediately after mount.", "Browser suite: binding `null` to `value` yields an empty string property.", "Browser suite: `String()` of the same markup still contains the control values as attributes.".

### Agent notes
# Ticket 06: form controls bind DOM properties

## Implemented

- `src/htm.browser.ts`: `_setAttr` treats `value`/`checked`/`selected` on
  INPUT/TEXTAREA/SELECT/OPTION as DOM properties. A `WeakMap` record
  (`_bound`) holds the last bound value per element+key; a write
  happens on the first bind or when the value differs by `Object.is`.
  `value` writes `String(v ?? '')`, the others `!!v`.
- `_create` and `_patch` now morph children before `_bindEl` (for all
  elements, which costs fewer bytes than special-casing SELECT), so a
  select's value is set after its options exist.
- `_str` (the `String()` path) is unchanged.
- `.size-limit.js`: browser templater limit 4.6 -> 4.7 kB (measured
  4.66 kB, +~110 B), recorded in a comment per the spec's rounding rule.
- AGENTS.md: a paragraph on control properties under the browser
  templater section.

## Tests (test/index.ts, "controls:" tests)

All six checklist items have tests. I checked each one against the
pre-change source: the value-property, input edit/bound-wins, checkbox
and select tests fail there. The null and `String()` tests also pass
on the old source (removing the attribute already gives '' on a clean
input, and `_str` was never changed); they guard against regressions.

## Notes for later tickets

- The adopt path (ticket 07) still goes through `_bindEl` -> `_setAttr`,
  so adopted controls currently get one property write on the first bind
  (the record is empty). Ticket 07 must seed the record from, or compare
  against, the live DOM property.
- The checkbox "bound wins" test must end with a bound value that
  differs from the DOM state. With booleans, that means the bound
  signal goes false -> true -> false after the visitor checks the box.
- Port 8123 is shared across worktrees; EADDRINUSE means retry.
- `npm test` needs `dist/` (run `npm run build` first in a fresh
  worktree).

---
<!-- nightralph:entry ticket=millitags-lessons:8 attempt=1 outcome=done -->
## 2026-10-14 21:10 -- millitags-lessons/08 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.61. Checked items: "`npm run gate` exists and runs the listed scripts in the listed order, stopping on the first failure.", "The README entry for `gate` says Playwright is run separately with `test:e2e`, and AGENTS.md points at `gate`.".

### Agent notes
# 08 one gate script -- notes

No tests written: config and docs only (scaffolding per the global rules).

Implemented `scripts.gate` in package.json, a gate entry in
example-hydration/README.md (the README that lists scripts; root README has
no script list), toc regenerated, and AGENTS.md "both suites must stay
green" now points at `gate`.

Deviation from the ticket order: build runs BEFORE typecheck. On a clean
checkout `npm run typecheck` fails (test/types.ts imports 'microtags',
which resolves to dist/). Lint passes without dist. So the order is:
rm example build, lint, build, typecheck, size, test, test:ssr,
test:build, test:plugins, test:cli, test:hydration, test:hydration-dev.

Blocker (criterion 2 left unchecked): `npm run gate` on a clean checkout
passes everything through test:cli (browser 286, ssr 79, build 33,
plugins 13, cli 23), then test:hydration fails in vite build with
'microtags/build requires "typescript" as a peer dependency', because
example-hydration/vite.config.ts imports `../src/vite.js`. This is the
"Example build" fix in .scratch/hydration-dx-fixes/spec.md, which the
ticket lists as blocking. That spec has no ticket yet, so no ticket
number recorded. Once it lands, re-run `npm run gate` from a clean
checkout to tick criterion 2.

---
<!-- nightralph:entry ticket=millitags-lessons:11 attempt=2 outcome=done -->
## 2026-10-14 21:12 -- millitags-lessons/11 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $0.55. Checked items: "ADR-008 ends with a dated note attributing the measurements to millitags and its toolchain, giving the three brotli sizes and the recovered fraction, and the deserializer import costs against `JSON.parse`.", "The note states the conclusion and leaves the Decision, Trade-offs and Consequences sections unchanged.", "The note contains no em dashes and no arrow characters.".

### Agent notes
# Ticket 11: ADR-008 note with measurements (attempt 2)

- Attempt 1's commit was not present in this worktree, so the note was
  re-written. Attempt 1 failed only because port 8123 was in use by
  another worktree's tapout run (EADDRINUSE), not because of the change.
- Implemented: appended "## Note (2026-10-14)" to
  docs/adr/ADR-008-serialized-server-state.md. Decision, Trade-offs and
  Consequences untouched (diff is additions only). INDEX.md unchanged.
- Figures: taken from attempt 1's notes, which copied them from
  ../millitags/docs/adr/ADR-005-inline-markup-and-route-bundles.md
  ("The narrowed serialization payload", measured 2026-08-18) and the
  ../millitags/src/revive.ts header. Not re-read this attempt because
  the agent rules forbid reading outside the worktree. Values: HTML
  509 B, payload 496 B, both 967 B brotli, 7.7% recovered; JSON.parse
  32, flatted 377, devalue 1959, turbo-stream 2477, seroval 3425 bytes
  brotli; millitags core 3519 bytes; hand-written reviver under 250.
  Arithmetic checks: 509+496-967 = 38, 38/496 = 7.7%; 3519/2 = 1759.5,
  so devalue, turbo-stream and seroval each exceed half.
- "More than half of a core bundle" read as millitags' own core, as
  the source states.
- No tests: docs only, per the global rule against testing docs. TDD
  skipped for this reason.
- No em dash or arrow characters (grep for U+2014/U+2192 finds none).
- Lint covers only ts/js, so it doesn't apply.
- No AGENTS.md learning added (the 8123 port note is already in the spec).
- Fresh worktree: ran `npm run build` before `npm test` (typecheck needs dist/). Final npm test: 286/286 pass.

---
<!-- nightralph:entry ticket=millitags-lessons:7 attempt=1 outcome=done -->
## 2026-10-14 21:32 -- millitags-lessons/07 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.99. Checked items: "Browser suite: adopting an input whose `value` attribute differs from the bound value sets the property to the bound value.", "Browser suite: after adoption, the user-edit-survives and bound-value-wins pair from ticket 06 holds for the adopted input.", "Browser suite: adopting a checked checkbox whose bound value is `true` produces no write; a bound `false` unchecks it.".

### Agent notes
# Ticket 07: adopted form controls compare against the live DOM

## Reading of the criteria

The ticket says the first comparison is "against the live DOM property",
but also that a value typed before hydration stays when the bound value
matches the server attribute. Comparing with `input.value` (the live,
dirty value) would overwrite the typed value, so the first adopt
comparison is against the server-rendered default: `defaultValue`,
`defaultChecked`, `defaultSelected` (these reflect the attributes),
falling back to the live property when there is no default (a
`select`'s `value`). Later runs compare against the `_bound` record as
in ticket 06.

## Progress

- Item 1 (matching attribute, no write, dirty value stays): test
  `adopt: a control whose attribute matches is not written`; red on the
  old code (typed value replaced by 'a'), green after the `_setAttr`
  change in `src/htm.browser.ts`.
- Items 2-4 committed together (one source change covered them):
  - `adopt: a control whose attribute differs gets the bound value`
    (regression guard; passes on old code too).
  - `adopt: an edit survives a re-render; a new bound value wins` and
    `adopt: an edit in an adopted region survives a re-render`. The
    region variant failed: `_bindEl` skipped static values on adopt, so
    a control's static `value` never seeded `_bound`, and the region's
    next run (via `_patch`) treated it as a first bind and wrote.
    Fix: on adopt, static control props go through `_setAttr(..., true)`
    (new `_ctl` helper shared with `_setAttr`); other statics still
    skipped.
  - `adopt: a checked checkbox bound true is not written` (also covers
    bound false unchecking). Fails on old code: a pre-hydration
    uncheck was overwritten.
- `.size-limit.js`: browser templater 4.95 -> 5 kB (measured 4.98 kB),
  per the spec's rounding rule.
- AGENTS.md: paragraph on adopted control comparison.

---
<!-- nightralph:entry ticket=millitags-lessons:10 attempt=1 outcome=done -->
## 2026-10-14 21:32 -- millitags-lessons/10 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.52. Checked items: "The new subsection covers URL schemes, `<script>` and `<style>` contexts, `raw`, invalid attribute names, and the void element rule.", "`npm run toc` has been run and the table of contents lists the subsection.", "The section contains no em dashes and no arrow characters.".

### Agent notes
# Ticket 10: README, what escaping does not cover

Docs only, so no tests (global rule: no tests for docs); TDD skipped.

- Added `#### What escaping does not cover` under `### microtags/htm`,
  after the existing Escaping / Void elements / Custom elements
  paragraphs. Covers URL schemes, script/style contexts, raw, invalid
  attribute names (regex rule, skipped silently on server, browser and
  host tag), and the void element throw.
- `npm run toc` run. It also dropped stale TOC entries under Hydration
  whose headings no longer exist in the README (correct regeneration).
- Checked: no em dashes or arrow characters in the new section.
- No AGENTS.md learnings worth adding.

---
<!-- nightralph:entry ticket=millitags-lessons:9 attempt=1 outcome=done -->
## 2026-10-14 21:33 -- millitags-lessons/09 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.84. Checked items: "Hydration suite: for each of the three markers, the marker is found in its named server build file (positive control), and the test reports the control file by name.", "Hydration suite: for each marker, every JavaScript asset under the client build is read and asserted to lack it, with one assertion per file.", "Hydration suite: a marker taken from a kept component's markup (Badge or Notice) is found in at least one client asset.", "Hydration suite: a marker that appears in no server file fails the positive control with a message saying the marker is stale (verified by a temporary bogus marker during development, not committed).".

### Agent notes
# 09 built-asset isolation check -- notes

The blocker (example build) is resolved at HEAD: `npm run build:hydration`
succeeds (vite.config.ts now imports ../dist/vite.js).

Implemented in test/hydration.ts: ISOLATION_MARKERS table, jsAssets()
recursive scan of build/client and build/server, a test that both scans
found files, one test per marker (positive control first, then one
assertion per client JS file), and an inverse test that
`class="badge-text"` (Badge, kept) is found in a client asset.

Markers:
1. Counter: `aria-label="Decrement"` (in build/server/app.js only).
2. Scaffold: `<!--microtags:main-->` (in build/server/app.js; also in the
   client index.html, which is not JS and is not scanned -- the spec says
   JS assets).
3. Build entry: `microtags/build requires "typescript"`. Interpretation:
   no file under example-hydration/build/server contains src/build.ts, so
   the control file is dist/build.js (built by build:node, which
   build:hydration runs first). Documented in a table comment.

Verified during development (not committed): a bogus marker failed with
"BOGUS marker is stale: not found in example-hydration/build/server/app.js",
and a marker present in the client (`notice-text`) failed the per-file
"lacks" assertion. The per-file loop is skipped when the control fails.

Running hydration test standalone needs `npm run build` first (dist/htm.js).
Lint requires example-hydration/build removed.

---
