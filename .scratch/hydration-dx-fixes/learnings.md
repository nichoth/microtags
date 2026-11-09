<!-- nightralph:entry ticket=hydration-dx-fixes:2 attempt=1 outcome=tests -->
## 2026-10-14 20:55 -- hydration-dx-fixes/02 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.93. Checked items: "Server output for an interpolated attribute holding `&`, `"` or `<` contains the value escaped exactly once", "A non-prop attribute on a component with value `true` renders as an empty attribute, and `false`, `null` and `undefined` render no attribute", "Every parity table case produces equal HTML from the server templater and the browser `String()` path, markers aside", "Existing exact-string static page assertions in the SSR suite pass unchanged", "`npm run test:ssr` and `npm test` pass".

Test gate failed.
Last 40 lines of `02-server-browser-attribute-parity.test.log`:
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
    at runTestsInBrowser (file:///Users/nick/code/microtags.hydration-dx-fixes-02-server-browser-attribute-parity/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.hydration-dx-fixes-02-server-browser-attribute-parity/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
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
# Ticket 02: server/browser attribute parity

Implemented:
- src/htm.ts: `_val` now unwraps `_Escaped` to its raw string, so plain
  element attributes and host non-prop attributes are escaped once.
  Host non-prop attrs follow browser rules: true -> '' (empty attr via
  `_renderHost`), false/null/undefined omitted, else String(v).
- src/builders.ts unchanged: `_renderHost` already renders '' as a bare
  attribute.
- test/parity.ts: shared table (plain + host attrs with & " ' <, the four
  boolean/null values, numbers, declared prop, nested markup, host
  children). `stripMarkers` removes `<!--[-->`/`<!--]-->` only; ticket
  for the `<!--[c-->` children marker must extend the regex.
- test/ssr.ts runs it against server `html`; test/index.ts runs it
  against browser `bhtml` and compares server vs browser.
- AGENTS.md: note on the parity table.

TDD: SSR test red (12 failures, double escaping and "true"/"false"
strings on hosts), then green. Browser test written after the fix;
verified red (12 failures) by reverting src/htm.ts, then green.

Gotcha: htm requires `<input />`; `<input ...>` yields "input[object Object]".
Fresh worktree needs `npm run build` before `npm test` (typecheck uses dist).
Delete example-hydration/build before lint.

Results: npm run test:ssr 98/98, npm test 324/324, lint clean.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:3 attempt=1 outcome=done -->
## 2026-10-14 20:57 -- hydration-dx-fixes/03 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.04. Checked items: "A MutationObserver attached before `mount` records no attribute mutations on adopted elements whose attributes are all static", "A bound attribute whose current value already matches produces no attribute mutation during adoption", "A bound attribute whose value differs is written once during adoption, and later signal changes still update it", "An adopted `<iframe>` does not fire a second `load` event after `mount`", "`npm test` and `npm run size` pass".

### Agent notes
# Ticket 03: passive adoption, no attribute writes

## Implemented
- `src/htm.browser.ts`: `_setAttr` gained a `keep` flag (skip when
  `getAttribute` already equals the serialized value; null covers the
  remove case). `_bindEl` and `_bindHost` take `adopt`; `_adopt` passes
  true. Static values are skipped while adopting; a bound attribute's
  first run uses keep; later runs write as before. Host `key` also uses
  keep while adopting (it was being rewritten).
- `test/index.ts`: four adoption tests (static attrs incl. host key and
  non-prop attr, matching bound attrs, differing bound attrs written
  once then still reactive, iframe gets no second load). All failed /
  were verified against the old implementation except "differs written
  once", which already passed before (it guards against regression).
- ADR-007 correction note; AGENTS.md learning.

## Size
Browser templater 4.59 kB (limit 4.6 kB). First version was 4.62 kB;
folding the compare into `_setAttr` brought it under, so no limit change.

## Gotchas
- `npm test` port 8123 collides with sibling worktree agents
  (EADDRINUSE). Retry loop waiting for the port to free.
- Delete example-hydration/build before lint.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:4 attempt=1 outcome=done -->
## 2026-10-14 20:57 -- hydration-dx-fixes/04 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.97. Checked items: "`npm test` and `npm run size` pass".

### Agent notes
# Ticket 04: raw() adoption alignment

## Item 1 (raw with two elements + newline, button onclick fires)
- Test: `adopt: a button after a multi-node raw() is bound` in test/index.ts
  (red: warning + listener not attached; green after fix).
- Fix: `_adopt` parsed-node branch in src/htm.browser.ts. Each parsed
  raw node consumes exactly one DOM node. Skipping happens only before
  the first node of the span (detected by `!item.previousSibling` in the
  parsed fragment), and only of nodes whose type differs from that first
  node (so a raw span starting with whitespace text or a comment is not
  skipped over). `_items` did not need changing.
- Port 8123 can be held by another worktree's `npm test`; retry.

## Item 2 (raw with text + element, bound attribute updates)
- Test: `adopt: a bound attribute after text-and-element raw() updates`.
  Uses `hi <b>a</b> <i>c</i>`: the inner whitespace text is what broke
  the old walker (a plain `hi <b>a</b>` passed even before the fix, so
  it would not have been a real red test). Verified red against the
  pre-fix src, green after.

## Item 3 (no adoption warning)
- Asserted inside both tests above (`quietly` captures console.warn).

## Items 4-5
- test:ssr 79/79 unchanged (server code untouched). Size: browser
  templater 4.58 kB of 4.6 kB, so no limit change and no ADR-007 note.
- lint clean (delete example-hydration/build first). npm test 292/292.
- AGENTS.md: added the raw-span adoption rule to the browser templater
  section.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:1 attempt=1 outcome=done -->
## 2026-10-14 20:58 -- hydration-dx-fixes/01 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.17. Checked items: "`npm run test:build` passes".

### Agent notes
# Ticket 01: example build from a fresh clone

## Done
1. example-hydration/vite.config.ts imports `../dist/vite.js` again
   (was `../src/vite.js`). README/AGENTS already said dist; README
   unchanged, so no toc:hydration run. The checklist item for this is
   config: no unit test, verified by running build:hydration,
   test:hydration, test:hydration-dev, test:e2e from a clean dist.
2. src/build.ts: the catch around `require('typescript')` now gives the
   peer-dependency message only when `err.code === 'MODULE_NOT_FOUND'`
   and the message names `'typescript'`. Anything else throws
   "require is unavailable or unusable here ... load from built form",
   with `cause`.
3. test/build.ts: three new tests that spawn processes:
   - esbuild src/build.ts as ESM piped to `node --input-type=module`
     (require undefined) -> message mentions require + built form.
   - esbuild as CJS run in an empty tmp dir -> peer message.
   - `npx vite build --config test/fixtures/vite-config-src/...`
     (config imports src/vite.ts) -> built-form message, no peer msg.

## Findings worth knowing
- `typeof require === 'undefined'` cannot be used as the guard: esbuild
  rewrites it to its `__require` shim, which is always defined.
- The real Vite failure is NOT "require undefined". Rolldown provides
  require via createRequire, but Vite's config bundler passes it a
  `file:///.../typescript.js` URL, giving MODULE_NOT_FOUND. Hence the
  check on the bare `'typescript'` name in the error message.
- esbuild's JS API cannot be bundled into test:build (worker path
  error), so the test spawns `npx esbuild`.
- Delete example-hydration/build before `npm run lint`.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:5 attempt=1 outcome=tests -->
## 2026-10-14 20:59 -- hydration-dx-fixes/05 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.22. Checked items: "Server output for a component with non-empty children wraps them in `<!--[c-->` and `<!--]-->`, and a component with no children emits no children markers", "A kept component whose render has a reactive region before its children is adopted so that a button inside the children fires its listener", "`npm run test:ssr`, `npm test` and `npm run size` pass".

Test gate failed.
Last 40 lines of `05-component-children-marker.test.log`:
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
    at runTestsInBrowser (file:///Users/nick/code/microtags.hydration-dx-fixes-05-component-children-marker/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.hydration-dx-fixes-05-component-children-marker/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
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
# Ticket 05 notes

## Item 1: server children marker
- src/htm.ts: added `_KIDS = '<!--[c-->'`, used for non-empty component children.
- test/ssr.ts: children assertion now expects `<!--[c-->`; added a no-children check.
- Static page exact-string assertions pass unchanged.

## Item 2: browser children range
- src/htm.browser.ts: `_range` looks for a `[c` comment; `_close` counts any
  comment starting with `[` as an opener; `_createHost` wraps kids in
  `<!--[c-->` too, so morphs of created hosts find the range the same way.
- `_skip` needed no change: it already skips every comment except `[`.
- test/index.ts: new region-before-children adoption test; existing
  children-range fixture switched to `<!--[c-->`.

## Item 3: depth matching
- Passed as soon as item 2 landed (TDD order note: implementation came with
  item 2). Adoption alone cannot observe depth -- `_adopt` walks past a
  too-early `end`. The test re-runs a region around the host so `_patch`
  morphs the children range; verified it fails when `_close` ignores depth.
- A morph always recreates nested function regions (`_patch` returns null
  for functions), so the test checks node count and button identity rather
  than identity of every node.

## Item 4/5: static pages, gates, docs
- Static page exact-string SSR assertions untouched and passing.
- Docs (no test, docs-only): CONTEXT.md Reactive region, ADR-007 decision
  text plus a dated Notes section, AGENTS.md marker lines.
- Size: browser templater 4.57 kB of 4.6 kB after rebuild; limit not raised.
  `npm run size` measures dist/, so rebuild first.
- Gotcha: `npm test` serves on port 8123 via tapout; parallel worktrees
  collide (EADDRINUSE). Wait for the other run instead of killing it.
- Final: lint clean, test:ssr 80/80, npm test 290/290, size passes.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:2 attempt=2 outcome=done -->
## 2026-10-14 21:00 -- hydration-dx-fixes/02 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $0.91. Checked items: "`npm run test:ssr` and `npm test` pass".

### Agent notes
# Ticket 02: server/browser attribute parity (attempt 2)

Attempt 1 failed only on EADDRINUSE :8123 at the gate (tapout's browser
server port, held briefly by another process -- likely a concurrent run
in another worktree). Same transient happened once in this attempt;
a rerun passed. Not a code problem.

Implemented:
- src/htm.ts: `_val` unwraps `_Escaped` to its raw string, so plain
  element attributes and host non-prop attributes are escaped once.
  Host non-prop attrs: true -> '' (bare attr via `_renderHost`),
  false/null/undefined omitted, else String(v). builders.ts unchanged.
- test/parity.ts: shared table + `ParityHost` (tag `parity-host`,
  renders children as is) + `stripMarkers` (already strips `<!--[c-->`
  for the planned children marker).
- test/ssr.ts: table vs expected. test/index.ts: browser table vs
  expected, and server vs browser.
- AGENTS.md: parity table note.

TDD: SSR red (double escape, "true"/"false" host strings) -> green.
Browser comparison verified red against the old src/htm.ts (9 fails),
browser-only expectations green throughout.

Fresh worktree: `npm run build` before `npm test`. Delete
example-hydration/build before lint.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:8 attempt=1 outcome=tests -->
## 2026-10-14 21:01 -- hydration-dx-fixes/08 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.87. Checked items: "`npm test` and `npm run size` pass".

Test gate failed.
Last 40 lines of `08-read-only-bound-props.test.log`:
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
    at runTestsInBrowser (file:///Users/nick/code/microtags.hydration-dx-fixes-08-read-only-bound-props/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.hydration-dx-fixes-08-read-only-bound-props/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
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
# Ticket 08: read-only bound props

Implemented: in `src/factory.ts`, the setup prop signal wrapper
throws `<tag>: prop "<name>" is bound and read-only; emit an event
instead` when called with an argument while a signal/computed is bound.
Unbound writes go to the host's own signal as before. The accessor's
plain-value path unbinds before writing, so it never hits the throw;
connectedCallback / attributeChangedCallback already skip bound props.

Tests (test/index.ts, "prop accessor" block): bound signal write throws
with tag + prop in message and page signal unchanged; computed-bound
write throws (verified red against the old factory); unbound prop
writable by setup; new signal from outside replaces binding. The last
two are regression guards (they pass on old code too -- behaviour kept).

Gotcha: tapzero `t.throws` returns a Promise; using it in a sync test
asserts after the test ends. Used try/catch + t.ok instead.

Docs (no test-first, docs only): CONTEXT.md Prop entry, ADR-007
Consequences paragraph, AGENTS.md prop accessor section.

Size: core 4.2 kB against its 4.2 kB limit, so no bump. Little room left.
Fresh worktree needs `npm run build` before `npm test` (dist/ missing).

Commits: item 1+2 together, items 3-5 together (one test commit), docs.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:7 attempt=1 outcome=done -->
## 2026-10-14 21:03 -- hydration-dx-fixes/07 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.25. Checked items: none.

### Agent notes
# Ticket 07: Markup brand symbol

## Implemented

- `src/htm.browser.ts`, `src/htm.ts`: `const _M = Symbol.for('microtags.markup')`,
  set on `Markup.prototype`, and an `_isMarkup` guard. The guard replaces the
  `instanceof Markup` checks in `_str`, `_items` and `html` (browser), and in
  `html` plus the `_Escaped` unwrap in `h` (server; now
  `_isMarkup(v) && '_raw' in v`).
- Browser `_items` now branches on `c._n` (a truthy node description) and
  otherwise parses `String(c)`, so server-copy markup (no `_h`) also mounts
  as HTML.
- `.size-limit.js`: browser templater limit 4.6 -> 4.65 kB (measured 4.61 kB).
  Recorded in an ADR-007 Consequences note.
- AGENTS.md: relaxed the two-copies note.

## Decisions

- The brand sits on the prototype, not in a class member. A `get [_M]()` member
  emits `declare const _M: unique symbol` in the d.ts. Each copy then has its
  own unique symbol type, so dist `Markup` and src `Markup` stop being
  assignable to each other. That broke typecheck in test/index.ts.
- `c?.[_M] === true` was 3 B bigger after brotli than `c != null && c[_M]`,
  so I kept the longer form.
- SSR "second copy" test: the browser templater (`src/htm.browser.ts`) has its
  own `Markup` class, so it stands in for another copy under Node without
  needing dist. Nesting browser markup in server html already worked through
  `String()`. The failing direction was server markup nested in browser html
  (the browser `_str` escaped it). Both directions are tested.
- Browser test uses the real second copy: `html`/`raw` from `'microtags/htm'`
  (dist), mounted with the src `mount`.

## Found, out of scope

- Parity bug: the browser templater escapes entities in static template text.
  `bhtml\`<i>a&amp;b</i>\`` stringifies to `a&amp;amp;b` (and mount shows the
  literal `a&amp;b`), while the server templater passes it through. Probably
  belongs to the parity-table ticket.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:12 attempt=1 outcome=tests -->
## 2026-10-14 21:04 -- hydration-dx-fixes/12 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.65. Checked items: "ADR-009 exists, is listed in the ADR index, and names one registration mechanism with the reasons the others lost", "ADR-009 records measured sizes for core, the browser templater, and an all-stripped fixture bundle for the chosen mechanism, using the review's method", "ADR-009 states the breaking change for code that calls a component's `render` static without a templater", "`npm run lint` passes and `src/` is unchanged".

Test gate failed.
Last 40 lines of `12-prototype-render-support-registration.test.log`:
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
    at runTestsInBrowser (file:///Users/nick/code/microtags.hydration-dx-fixes-12-prototype-render-support-registration/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.hydration-dx-fixes-12-prototype-render-support-registration/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
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
# Ticket 12 notes: prototype render-support registration, ADR-009

## TDD decision
All four checklist items are docs or measurement (ADR text, index row,
lint/src-unchanged check). No production code lands, so test-first adds
nothing; skipped deliberately. Evidence instead: measure.sh output and
two smoke checks (output parity and cross-copy registration) run ad hoc.

## What was done
- Prototype in `.scratch/hydration-dx-fixes/prototype-12/`:
  `common/builders.ts` (core delegating `render` via `_renderVia` and a
  render record {t, m, r, f}), `common/render-static.ts` (moved
  serializers/escape/host builder), per-variant `render-hook.ts` +
  `render-support.ts` for A (side-effect slot), B (setter), C (global
  Symbol.for hook); fixtures `all-stripped.ts`, `kept.ts`; `measure.sh`
  (copies src to a work dir, overlays variant, builds with esbuild,
  checks metafiles, measures with size-limit; `KEEP=1` keeps work dir).
- Baseline reproduces the review: core 4.17, htm 1.43, browser 4.56.
- Chosen: C (global hook). Core 3.93 kB, all-stripped 3.83 -> 3.63 kB,
  kept fixture 3.87 -> 4.00 kB, browser templater 4.93 kB.
- Smoke checks (not committed, run inline): C and A give byte-identical
  server output to baseline and throw before registration; with core and
  templater from two copies of src, C renders, A throws, B only works
  with a manual setter call on the right copy.
- ADR-009 written; INDEX row added (marks "amends ADR-005").
- AGENTS.md: section on scratch prototypes being linted and how to run
  size-limit against variant bundles.

## For ticket 13 / 14
- Proposed subpath name: `microtags/render-support`; key
  `Symbol.for('microtags.render')`.
- The kept-render overhead (+0.13 kB) is mostly the error message and
  record; shorten the message.
- Browser templater will exceed 4.6 kB (prototype 4.93); spec rule:
  raise to measured rounded up to next 0.05, note in ADR-007.
- Core budget proposal 3.95 kB; ticket 13 sets the final number.
- ADR-005 itself was not edited (ticket 13 adds its notes); the amend
  relation is recorded in ADR-009's header and the index row.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:8 attempt=2 outcome=done -->
## 2026-10-14 21:05 -- hydration-dx-fixes/08 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $0.94. Checked items: "`npm test` and `npm run size` pass".

### Agent notes
# Ticket 08: read-only bound props (attempt 2)

Attempt 1 failed only because tapout hardcodes port 8123 and another
process (likely a parallel ticket's test run) held it. I wait for the
port with `nc -z localhost 8123` before running tapout.

## Item 1+2 (done)
src/factory.ts: setup prop wrapper throws
`<localName>: prop "<name>" is bound and read-only; emit an event instead`
when called with an argument while bound. Test in test/index.ts
"prop accessor: writing a bound prop in setup throws" (red first).

## Items 3-5 (done)
Tests: computed-bound write throws (red on old factory, green now);
unbound prop writable by setup; new signal from outside replaces the
binding. The last two pass on old code too: they are regression guards
for behaviour the ticket says must stay unchanged.

## Docs (done, no test-first: docs only)
CONTEXT.md Prop entry, ADR-007 Consequences paragraph, AGENTS.md prop
accessor section. Also added to AGENTS.md: tapout's fixed port 8123
and tapzero `t.throws` being async.

## Gate
Rebuilt dist, `npm test` 297/297, `npm run size` exit 0 (core 4.2 kB
of 4.2 kB, no bump; almost no headroom left for later tickets),
`npm run lint` clean. All committed.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:5 attempt=2 outcome=done -->
## 2026-10-14 21:05 -- hydration-dx-fixes/05 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $1.44. Checked items: "A host with nested hosts in its children still resolves the outer children range (depth matching)", "Existing exact-string static page assertions in the SSR suite pass unchanged", "`npm run test:ssr`, `npm test` and `npm run size` pass".

### Agent notes
# Ticket 05 notes (attempt 2)

Attempt 1 failed only at the gate: `npm test` hit EADDRINUSE on port
8123 (tapout), from a parallel worktree. Its work was not in this
worktree, so it is redone here.

## Item 1: server children marker
- src/htm.ts: `_KIDS = '<!--[c-->'` wraps non-empty component children.
- test/ssr.ts: children assertion expects `<!--[c-->`; added a check that
  a component with no children gets no markers (passed before the change;
  it guards the "no children" half of the item).

## Item 2: browser children range
- src/htm.browser.ts: `_range` matches the `[c` comment; `_close` counts
  both `[` and `[c` as openers; `_createHost` wraps kids in `<!--[c-->`
  so `_patch` finds the range on hosts the browser created.
- `_skip` unchanged: it already skips every comment but `[`, which
  includes `[c` (only ever reached via `_range`).
- test/index.ts: new "region before the children" adoption test (red:
  listener not bound, "expected <button>, found none"); the existing
  children-range fixture switched to `<!--[c-->`.
- Fresh worktree had no dist/; `npm run build` before `npm test`.

## Item 3: depth matching
- Read "nested hosts in its children" as two cases in one test: the
  outer render holds a nested host with its own `[c` range before the
  outer children (needs `_range` to skip nested hosts), and the outer
  children hold a nested host plus a region (needs `_close` depth).
- Passed on first run, since item 2 already counted `[c` in `_close`.
  Verified by mutation: dropping depth counting fails "children range
  morphed whole"; FILTER_SKIP instead of FILTER_REJECT in `_range` fails
  four assertions. Source restored after each.
- Adoption alone cannot see a too-early `end` (the walker steps past
  it), so the test re-runs a region around the host to make `_patch`
  morph the children range. Region placed last in the children: a morph
  matches unkeyed nodes by position and always recreates function
  regions, so a region before the button would recreate the button.
- Port 8123 (tapout) collides with parallel worktrees; retry after a
  wait rather than killing the other run.

## Item 4/5: static pages, docs, gates
- Static-page exact-string SSR assertions untouched (diff of test/ssr.ts
  shows only the children test) and passing.
- Docs, no test (docs only): CONTEXT.md Reactive region; ADR-007
  decision text plus a dated Notes section; AGENTS.md marker lines and
  test gotchas (depth observability, port 8123).
- Size: browser templater 4.57 kB of 4.6 kB after rebuild; limit not
  raised. `npm run size` measures dist/, so rebuild first.
- Final: lint clean, test:ssr 80/80, npm test 293/293, size passes.
- Not run: test:hydration / e2e (spec says the example build is broken
  at HEAD until ticket for finding 1 lands).

---
<!-- nightralph:entry ticket=hydration-dx-fixes:12 attempt=2 outcome=done -->
## 2026-10-14 21:10 -- hydration-dx-fixes/12 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $1.81. Checked items: "ADR-009 exists, is listed in the ADR index, and names one registration mechanism with the reasons the others lost", "ADR-009 records measured sizes for core, the browser templater, and an all-stripped fixture bundle for the chosen mechanism, using the review's method", "ADR-009 states the breaking change for code that calls a component's `render` static without a templater", "`npm run lint` passes and `src/` is unchanged".

### Agent notes
# Ticket 12 notes (attempt 2): prototype render-support registration

## Why attempt 1 failed
Its test gate died with EADDRINUSE on port 8123 (tapout's browser
server), which is environmental: another test run held the port. The
worktree had been reset, so all work was redone. Port 8123 was free at
the start of this attempt.

## TDD decision
All checklist items are docs, measurement or lint/src checks. No
production code lands, so test-first was skipped deliberately. Evidence
is the measure.sh output: size-limit numbers, metafile inputs, the SSR
suite (79/79) against each variant, and smoke checks.

## What was done
- `.scratch/hydration-dx-fixes/prototype-12/`: `common/builders.ts`
  (core with delegating `render` and a record {t, m, r, f}; PropKind
  gains `boolean` and `json` so the support module never compares
  coercer identity), `common/render-static.ts` (support module), per
  variant `render-hook.ts` + `register.ts` (B also `index.ts`,
  `templater-register.ts`), fixtures, `measure.sh <variant>`
  (`KEEP=1` keeps the temp copy).
- Chosen: C, global hook `Symbol.for('microtags.render')`.
- C sizes: core 3.92, htm 1.71, browser 4.80, all-stripped 3.62
  (baseline 3.81), kept 3.91 (baseline 3.84). Baseline reproduces the
  review (4.17 / 1.43 / 4.56).
- Decisive evidence: A and B throw when core and templater come from
  separate copies, including the unsplit CJS build (`index.cjs` +
  `htm.cjs`); C renders. Found while prototyping: comparing coercer
  identity in the support module breaks booleans across copies
  (`open="true"`), hence the kind recorded in core.
- ADR-009 written, INDEX row added (marked "amends ADR-005"). ADR-005
  itself not edited; ticket 13 adds its note.
- AGENTS.md: note that `.scratch/**/*.ts` is linted and how to measure
  a core change in a temp copy.

## For tickets 13 and 14
- Subpath name proposal `microtags/render-support`.
- Core budget proposal 3.95 kB; ticket 13 sets the final number.
- Browser templater will exceed 4.6 kB; raise per spec rule and note in
  ADR-007.
- The record shape passed to the support function is a cross-version
  contract; changing it needs a new symbol key.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:6 attempt=1 outcome=done -->
## 2026-10-14 21:26 -- hydration-dx-fixes/06 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.88. Checked items: "Server DOM `<h1><p><button>` adopted against markup `<p><button>` logs one warning at most and the button's listener fires", "Server DOM `<p><button>` adopted against markup `<h1><p><button>` logs one warning and the button's listener fires", "The skipped server nodes are the same node objects after adoption", "`npm test` and `npm run size` pass".

### Agent notes
# Ticket 06: mismatch lookahead

- Tests (test/index.ts): `adopt: an extra server node costs one warning`
  and `adopt: a missing server node costs one warning`. Both red before
  the fix (listener unbound, extra warnings), green after. They also
  assert the skipped/server node is the same object and innerHTML is
  unchanged.
- Fix: mismatch branch of `_adopt` in src/htm.browser.ts. Always warns,
  then scans later siblings up to `end` for the expected tag, jumping
  over `<!--[-->`/`<!--[c-->` ranges via `_close` so it never adopts an
  element inside a region. If none found, `n` is not advanced.
- Warning count: warns even when lookahead succeeds (ticket allows "one
  warning at most").
- Size: browser templater 4.99 kB > 4.95 kB limit, raised to 5 kB in
  .size-limit.js with a note in ADR-007 (Notes section). ADR-007's
  "warns in development" corrected to "always warns" + lookahead.
- Port 8123 was busy once (EADDRINUSE); retried in a loop.
- npm test 421/421, lint clean, size passes.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:10 attempt=1 outcome=tests -->
## 2026-10-14 21:28 -- hydration-dx-fixes/10 attempt 1 -- failed (tests)

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.24. Checked items: "`createApp` accepts no page-content options, and any formerly optional heading or label comes from the serialized state script", "A request for a path outside the prefix returns 404 and its serialized state carries the not-found route", "A request for `/index.html` under the prefix renders the home link with the current-page attribute set", "`npm run test:hydration`, `npm run test:hydration-dev` and the listener test pass".

Test gate failed.
Last 40 lines of `10-example-server-state-only-inputs.test.log`:
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
    at runTestsInBrowser (file:///Users/nick/code/microtags.hydration-dx-fixes-10-example-server-state-only-inputs/node_modules/@substrate-system/tapout/dist/index.js:111:12)
    at main (file:///Users/nick/code/microtags.hydration-dx-fixes-10-example-server-state-only-inputs/node_modules/@substrate-system/tapout/dist/cli.js:108:11)
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
# Ticket 10 notes

## Item 1: createApp has no page-content options
- `AppState` gains `heading` and `badgeLabel` (serialized, defaults keep
  the old text). `IndexPage(state)` reads them with plain calls
  (`state.heading()`), so output shape is unchanged (no region markers,
  no prop binding).
- `IndexOptions` and `AppOptions.index` removed.
- Test "body text ... escaped exactly once" now builds state with
  `State({heading, badgeLabel})` and goes through `assemble` +
  `stateScript` from source (no way to inject state into createApp).
- Moved STATE_RE/stateScripts/payload helpers to the top of
  test/hydration.ts.
- Fresh worktree: run `npm run build` before test:hydration (dist/htm.js).

## Item 2: paths outside the prefix
- `NOT_FOUND_ROUTE = '/404'` exported from pages/routes.ts (not in
  ROUTES). `stateFor` uses it for any path not starting with
  `PREFIX + '/'` (so `/example-hydrationx` is outside too).
- Test asserts 404 + `pageFor(payload.route) === NotFoundPage` + no
  current link, for `/list`, `/`, `/example-hydrationx`.

## Item 3: /index.html is route `/`
- `stateFor` maps `${PREFIX}/index.html` to `/`; `/index.html` removed
  from ROUTES (it is never a route now). Tests: payload route and
  aria-current cases for `/index.html`.

## Final checks
- test:hydration (126 + 17 listener), test:hydration-dev (17), npm test
  (413), lint, typecheck, typecheck:hydration, test:e2e (12) all pass.
- The reduce-fouce scaffold test is untouched: removing it belongs to a
  different ticket (spec finding 7).

---
<!-- nightralph:entry ticket=hydration-dx-fixes:13 attempt=1 outcome=done -->
## 2026-10-14 21:30 -- hydration-dx-fixes/13 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.74. Checked items: "Calling a component's `render` static with no templater and no support import throws an error that names the support module", "After importing the server templater, `render` produces the same host HTML as before, and every existing SSR exact-string assertion passes unchanged", "After the browser templater creates a host, `render` works without a separate support import", "Core's size-limit entry is lowered to the ADR-009 number and `npm run size` passes", "`npm run build`, `npm run test:ssr`, `npm test`, `npm run test:hydration` and `npm run lint` pass".

### Agent notes
# Ticket 13 notes: server render support module

## Implemented
- `src/render-support.ts` (new, `microtags/render-support`): `_escAttr`,
  `_attrName` guard, `_serialize` by kind, `renderHost(rec, props, opts)`,
  `register()` storing renderHost at `Symbol.for('microtags.render')`;
  module calls `register()` on load (mechanism C from ADR-009).
- `src/builders.ts`: PropKind gains `boolean`/`json` (decided by coercer
  identity in core); PropMeta drops `serialize`; `RenderRecord` {t,m,r,f};
  render static reads the symbol and throws
  `microtags: render needs "microtags/render-support"` when unset.
- `src/htm.ts`: `import './render-support.js'`.
- `src/htm.browser.ts`: imports `register`, calls it in `_createHost`.
- package.json: exports entry + added to build-cjs/build-esm/build-esm:min.
- `.size-limit.js`: core 4.3 -> 3.95 kB (measured 3.93); browser templater
  4.95 -> 5.2 kB (measured 5.18), per spec rounding rule.
- Docs: README (render note + subpath section, toc rerun, which also
  dropped dead TOC entries), ADR-005 note, ADR-007 correction + note,
  ADR-009 implementation note, AGENTS.md "Builder and serialization".

## Tests
- SSR: `test/fixtures/render-unregistered.ts` run in its own process from
  `test/ssr.ts` (the suite imports the templater, so in-process would be
  registered). Red before core change, green after.
- Existing exact-string SSR tests went red (19 fails) after the core change
  and green once htm.ts imported the support module; test/ssr.ts diff is
  only the new test.
- Browser: `mount: creating a host registers render support` clears the
  registry symbol, mounts a kept host, calls render. Red (throw) until
  `_createHost` called `register()`.
- Size-limit item: config, no test; verified with `npm run size`.
- Sanity: all-stripped prototype fixture bundled against src has no
  render-support input in metafile and no `&quot;` table. Ticket 14 owns
  the formal plugins-suite check and transform import injection.

## Gate
lint, build, size, test:ssr 114/114, npm test 415/415, test:hydration,
test:plugins, test:build, test:cli, test:hydration-dev all pass.
Port 8123 was busy once (other worktree); waited and retried.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:9 attempt=1 outcome=done -->
## 2026-10-14 21:31 -- hydration-dx-fixes/09 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.35. Checked items: "Counter no longer contains an `as unknown as` cast and the nested Badge still follows the computed label", "`npm run typecheck`, `npm test`, `npm run test:hydration` and `npm run size` pass".

### Agent notes
# Ticket 09: typed bind helper

## Done
1. `bindProp(host, name, source)` exported from core (src/factory.ts,
   re-exported in src/index.ts). Named `bindProp`, not `bind`, because
   `ctx.bind` already exists with a different meaning (DOM property).
   Types: `H extends HTMLElement`, `K extends Exclude<keyof H, keyof
   HTMLElement>`, `source:() => H[K]` so both signals and alien-signals
   computeds are accepted. Runtime is `host[name] = source`.
   Browser test: "bindProp: the host prop reads and tracks the signal".
2. test/types.ts: matching signal and computed compile; mismatched
   types and a non-prop key (`id`) are `@ts-expect-error`. I checked
   that the expect-errors depend on the real signature by loosening
   dist/factory.d.ts temporarily (they turned into "unused directive").
3. Counter uses `bindProp(ctx.refs.current, 'label', label)`. The
   existing "example Counter" browser test (count(40) -> badge text 40)
   covers the nested badge following the computed; also switched its
   own cast to bindProp. e2e (12 tests) passed too.
4. Size: a `function` declaration put core 4 B over 4.3 kB; an arrow
   `export const` brought it to 4.28 kB, so no limit bump.
   .size-limit.js unchanged.
5. Docs: README API section `bindProp` (+ toc regen, which also removed
   stale hydration TOC entries for headings that no longer exist),
   CONTEXT.md Prop entry, example-hydration README counter note,
   MicrotagHost doc comment, AGENTS.md learnings.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:11 attempt=1 outcome=done -->
## 2026-10-14 21:32 -- hydration-dx-fixes/11 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.16. Checked items: "With every `.js` request aborted, the document's computed opacity is not 0 after load on `/`", "On `/list`, a MutationObserver started at `interactive` sees no text node replacement inside badge hosts during hydration", "On `/list`, the same observer sees no attribute mutations during hydration", "The client entry's import order places Badge and Notice before Counter, and the stripped client still asserts Counter has no render", "`npm run test:e2e`, `npm run test:hydration` and `npm run lint` pass".

### Agent notes
# Ticket 11: example page visible without JS, quiet under hydration

## Done
1. e2e (test/e2e/hydration.spec.ts): three new tests, all red first.
   - "the page is visible when no script loads": .js aborted, computed
     opacity of <html> != 0 on /.
   - "hydrating /list replaces no text inside badges" and "... writes
     no attributes": MutationObserver started from addInitScript at
     readystatechange=interactive, records pushed in the callback.
     Red causes: Badge setup rewrote textContent; reveal removed the
     html class (attribute write).
2. Deleted reduce-fouce (index.html class + noscript, index.css rule),
   client/util.ts (reveal) and its call, the reveal unit tests in
   test/index.ts, and the test:hydration test that asserted the class
   was present (the behaviour is removed, not weakened). Dropped the
   obsolete `not.toHaveClass(/reduce-fouce/)` lines in e2e.
3. Badge setup writes text only if `textContent !== label`.
4. client/index.ts imports Badge, Notice, then Counter, with a comment.
   No test added: order is config. The existing runtime assertion
   (Counter.render undefined) and its e2e check still pass. I could not
   find an observable failure from the old order to test against.
5. README: util.ts entry replaced, index.ts entry notes the order,
   badge entry describes write-on-change, cascade paragraph explains
   evaluation order. toc:hydration re-run (no TOC change).

## Gotchas
- takeRecords() after a no-op callback returns nothing: records were
  already delivered. Accumulate in the callback.
- One e2e run had exactly the three new tests fail, then 8+ clean runs.
  Likely a sibling worktree's server on 8899 (reuseExistingServer).
- Delete example-hydration/build before lint; test:hydration needs
  `npm run build` (dist/htm.js) first.

## Verified
test:e2e 15/15, test:hydration 112 + 17, lint, typecheck, npm test 410.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:10 attempt=2 outcome=done -->
## 2026-10-14 21:33 -- hydration-dx-fixes/10 attempt 2 -- done

Effort: high. Agent exit: 0. Subagents: 0. Cost: $1.09. Checked items: "`createApp` accepts no page-content options, and any formerly optional heading or label comes from the serialized state script", "`npm run test:hydration`, `npm run test:hydration-dev` and the listener test pass".

### Agent notes
# Ticket 10 notes (attempt 2)

Attempt 1 did the work but the gate failed on EADDRINUSE (port 8123,
another worktree testing). Its commits were not kept; redone here.

## Item 1: createApp has no page-content options
- `AppState` gains `heading` and `badgeLabel` (serialized, defaults keep
  the old text). `IndexPage(state)` reads them with plain calls.
- `IndexOptions` and `AppOptions.index` removed.
- New test: every route's response equals `assemble(scaffold,
  Layout(State(payload)), stateScript(...))` rendered from source, even
  with a stray `index` option passed (red before the change).
- Escape test now renders `State({heading, badgeLabel})` via the same
  helper. Removed the "index page takes heading and label as arguments"
  test (API gone; escaping is covered by the state-based test).
- Fresh worktree: `npm run build` first (dist was empty).

## Item 2: paths outside the prefix
- `NOT_FOUND_ROUTE = '/404'` in pages/routes.ts (not in ROUTES).
  `stateFor` uses it for any path not starting with `PREFIX + '/'`, so
  `/example-hydrationx/...` is outside too. Bare PREFIX still redirects.
- Test: `/list`, `/`, `/example-hydrationx/list` -> 404, payload route
  maps to NotFoundPage, no aria-current link.

## Item 3: /index.html is route `/`
- `stateFor` maps `${PREFIX}/index.html` to `/`; `/index.html` removed
  from ROUTES. Tests: payload-route and aria-current cases for it.
- Checklist item 4 (suites pass) has no test of its own.

## Final checks
- test:hydration (129 + 17 listener), test:hydration-dev (17), test:ssr
  (112), npm test (413), lint, typecheck, typecheck:hydration,
  test:e2e (12) all pass. toc:hydration produced no change.

---
<!-- nightralph:entry ticket=hydration-dx-fixes:14 attempt=1 outcome=done -->
## 2026-10-14 21:41 -- hydration-dx-fixes/14 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.91. Checked items: "The example client still renders Badge and Notice in the browser after a production build", "`npm run test:build`, `npm run test:plugins`, `npm run test:hydration`, `npm run test:e2e` and `npm run size` pass".

### Agent notes
# Ticket 14 notes: transform injects the render support import

## Implemented
- `src/build.ts`: `transform` sets `keptLink` when a define-chain render
  link is kept (client:true or keep list). After strip and cascade it
  appends `\nimport 'microtags/render-support'\n` unless the original
  source already imports that specifier. Appending (not prepending)
  keeps every existing line and column unchanged; imports are hoisted.
- `example-hydration/vite.config.ts`: alias `microtags/render-support`
  to `src/render-support.ts`, matching the `microtags` alias (otherwise
  it resolves to `dist/` via package exports).
- esbuild/vite plugins needed no change.
- Docs: README (`microtags/build` "Support import" paragraph, render-support
  section), ADR-009 note with final measurements, AGENTS.md learnings.

## Tests
- test/build.ts: kept link -> exactly one import, idempotent on re-run;
  keep-by-tag; cascade keeps it and stays idempotent; no existing line
  shifts; all stripped -> none (with and without cascade); no define ->
  none. Red (5 fails) before the change, green after.
- test/plugins.ts + fixtures `support-stripped.ts`, `support-kept.ts`:
  esbuild bundle with an onResolve plugin mapping microtags to src,
  metafile inputs checked for `render-support.ts`. Verified the kept
  test fails against the pre-change build.ts.
- Item 4 (example renders Badge/Notice after production build): covered
  by existing e2e tests "notice opens, dismisses, and opens again" and
  "list adopts, adds, and removes keyed badges"; no new test. Note that
  the browser templater also registers support, so these do not isolate
  the injected import; the metafile test does.

## Measurements (size-limit brotli, kB)
core 3.96, htm server 1.93, htm browser 5.29, example client strip on
8.52 / off 8.64, all-stripped fixture 3.63 (3.65 with no plugin), kept
fixture 3.95. Measured with a throwaway temp dir (repo package.json +
node_modules symlink + temp .size-limit.js); removed after.

## Gotchas
- `dist/esbuild.js` (ESM) cannot be imported by plain Node ESM: it
  fails `require('typescript')`. Use `dist/esbuild.cjs` from scripts.
  Pre-existing, not fixed (out of scope).
- First fixtures commit had a typecheck error (RenderContext uses
  `props.count`, not `count`); fixed in a follow-up commit.

## Gate
`npm run gate` exit 0 (npm test 434, ssr 114, build 48, plugins 16,
cli 23, hydration 136+17, hydration-dev 17, size ok). `test:e2e` 15/15.

---
