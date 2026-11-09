<!-- nightralph:entry ticket=preact-adapter:2 attempt=1 outcome=done -->
## 2026-11-08 22:00 -- preact-adapter/02 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.62. Checked items: "`docs/adr/ADR-010-preact-adapter-ownership-split.md` exists with context, decision, trade-offs and consequences sections covering every point above.", "`docs/adr/INDEX.md` lists ADR-010 dated 2026-11-08.", "The ADR uses the `CONTEXT.md` meanings of **Hydration** (the intent) and **Adopt** (the mechanism), and says the adapter keeps Preact from undoing hydration without adopting anything itself.", "`npm run lint` passes; the ADR contains no em dashes and no arrow characters.".

### Agent notes
# Ticket 02: ADR-010 notes

Docs-only ticket, so test-first was skipped: an ADR has no seam a test
could exercise, and the global rules forbid tests for docs.

Files: docs/adr/ADR-010-preact-adapter-ownership-split.md (new),
docs/adr/INDEX.md (row plus link reference, style of rows 006-009).

Interpretation: "Relate it to ADR-005, ADR-009, ADR-004" is done with a
Related header line and links in the body. The Trade-offs section holds
the dependence on Preact diff internals and the props-before-definition
edge. Consequences holds no children, no render code in the browser
build, the optional peer dep, and the new renderParts registry symbol.

Verification: npm run lint clean; no em dashes or arrow characters;
npm test 440/440 after `npm run build` (a fresh worktree has no dist/,
so typecheck fails until you build, as AGENTS.md already says).

No AGENTS.md change: nothing reusable came out of this ticket.

---
<!-- nightralph:entry ticket=preact-adapter:1 attempt=1 outcome=done -->
## 2026-11-08 22:07 -- preact-adapter/01 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.94. Checked items: "SSR suite: a class with no render link (defined without one, and one whose render link the `microtags/build` transform stripped) has no `renderParts` static.", "`test/types.ts`: `RenderParts` is importable from `'microtags'`, and `El.renderParts` returns it for a class from `setup`.", "`npm run size` passes with the core limit raised only as far as the measured size requires.".

### Agent notes
# Ticket 01 notes

## Item 1: assembled parts == render
- render-support: `renderParts(rec, props, options)` returns { tag, attrs, html };
  `renderHost` now builds its string from the parts. Registered under
  `Symbol.for('microtags.renderParts')` beside `microtags.render`.
- attrs built as pairs -> Object.fromEntries so a `__proto__` key from
  data stays an own property. Duplicate names (declared prop and extra
  attr with the same name) keep the first value. Before, the string held
  both; an HTML parser keeps the first, so the parsed result is the same,
  but bytes differ in that one edge case (no existing test covered it).
- core: one `link(key)` helper builds both statics.
- test/ssr.ts: `assembleParts` helper + PartsEl fixture with every prop kind.

## Items 2-3: attrs content and true boolean
- Tests written after item 1's implementation, so they passed on first
  run; mutation check (dropping the _attrName filter) made 3 assertions fail.

## Item 4: no render link
- Stripped case: transform(test/fixtures/strip-render.ts) in-process, then
  write the output to a temp dir and run it in a child process (esbuild
  --alias:microtags=src/index.ts). new Function is banned by lint (no-new-func).
- Mutation check: defining renderParts on link-less classes fails both assertions.

## Item 5: unregistered fixture prints one line per static (render, renderParts).

## Item 7: test/types.ts imports RenderParts from 'microtags' (needs a rebuilt dist/)
- Types were added with item 1, so these assertions were not seen red.

## Item 8: size
- Baseline (c598b54): core 3956 B, htm.browser 5306 B.
- After: core 3994 B (under the 4 kB limit, which is also the measured
  size rounded up, so the limit stays 4 kB; comment updated).
- htm.browser bundles render support (it calls `register`), so it grew to
  5386 B and failed its 5.35 kB limit. Shrunk render support (null-proto
  attrs record with `??=` for extras, for-in over rec.m), then raised that
  limit to 5.4 kB. The ticket only names the core limit; this second raise
  was unavoidable since renderHost now goes through renderParts.
- attrs is now a null-prototype object (replaces the pairs/Set version).

## Final
- npm run gate passed (exit 0): browser 440 pass, ssr 128 pass.
- Docs: README builder.render + render-support sections, CONTEXT.md
  'Render parts' term and Statics list. AGENTS.md updated.

---
<!-- nightralph:entry ticket=preact-adapter:3 attempt=1 outcome=done -->
## 2026-11-08 22:13 -- preact-adapter/03 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.56. Checked items: "`npm run gate` runs the new suite and passes.".

### Agent notes
# Ticket 03 notes

## Item 1: renderToString matches render
- src/preact-shared.ts: types (PreactElementClass, PreactProps, ...) and
  splitProps (declared / events by DOM name / passthrough; throws on children).
- src/preact.ts: default build; imports ./render-support.js; passthrough
  attrs go through renderParts as extra attrs (String(v), null dropped) so
  the name filter and ctx.attrs match the render static; '' -> true.
- Missing renderParts is checked at render time (not in toPreact).
- test/preact-ssr.ts with parseHost helper (no parser dep).
- package.json: preact 10.29.7 exact, preact-render-to-string ^6.8.2,
  test:preact-ssr script, added to gate after test:ssr.

## Items 2-3: boolean, passthrough, callbacks
- Tests passed on first run (implementation from item 1).
- Mutation: removing the event filter in splitProps fails item 3.
- Mutation: dropping the '' -> true mapping does NOT fail item 2:
  preact-render-to-string 6.8.2 already prints a '' value as a bare
  attribute. The mapping stays because the ticket asks for it and the
  browser/hydrate side may differ.

## Items 4-5: throws
- "no render link" uses a class defined without .render() (the ticket's
  "stripped or never written"; the stripped path is the same runtime
  shape, covered by ticket 01's test that stripped classes lack renderParts).
- Mutation: removing the children throw fails item 5.

## Items 6-7: types and build
- exports["./preact"] (types/import/require), src/preact.ts in build-cjs
  and build-esm. Not in build-esm:min (no size entry until ticket 04).
- peerDependencies preact "^10.29.7" (optional): the browser mechanism
  relies on Preact 10 diff branches.
- dist/preact-shared.d.ts is emitted alongside dist/preact.d.ts.
- Only dist/preact.{js,cjs} import preact (grep checked).
- test/types.ts: mutation (children?:unknown) makes the children
  @ts-expect-error unused, so it is real.
- Declared props are Partial in the adapter (HTML attributes are optional).
- Build wiring is config: no test-first; covered by the types test.

## Item 8: gate
- npm run gate exit 0: browser 440, ssr 128, preact-ssr 15, build 48,
  plugins 16, cli 23, hydration 136/17, hydration-dev 17.

---
<!-- nightralph:entry ticket=preact-adapter:4 attempt=1 outcome=done -->
## 2026-11-08 22:19 -- preact-adapter/04 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $1.49. Checked items: "Browser suite: after Preact's `hydrate` of the adapter over the component's server string, an inner node referenced before hydrate is the same node and still connected.", "`test/types.ts`: the browser build's `toPreact` type equals the default build's.", "`npm run size` passes with the new browser adapter entry, and `npm run gate` passes.".

### Agent notes
# Ticket 04 notes

## Item 1: hydrate keeps inner node
- src/preact.browser.ts: splitProps, declared props + passthrough as
  vnode props, `on<event>` per mapped event, shared EMPTY __html.
- test/preact-browser.ts (imported at end of test/index.ts).
- Gotcha: htm needs `<input />` self-closed, else the render static
  emits `input[object Object]`.
- Mutation: removing dangerouslySetInnerHTML fails the test.

## Items 2-6: re-render, typed value, client-only, events, children
- Tests in test/preact-browser.ts passed on first run (adapter from
  item 1); committed together.
- Mutations: dropping the `on` loop fails the event test; dropping
  declared props from vnode props fails re-render and client-only;
  removing the shared children throw fails the children test.
- The test component renders its own markup in setup when the host is
  empty (core does not render on connect), with no refs (refs are
  collected before setup, so an empty host would throw).

## Items 7-8: types, build, size, gate
- package.json: exports["./preact"].browser (types/import) listed
  first; src/preact.browser.ts added to build-esm and build-esm:min
  (with --external:preact).
- .size-limit.js: `microtags/preact (browser)`, ignore ['preact'],
  measured 443 B, limit 450 B.
- test/types.ts: src browser vs src default toPreact Equal, and
  'microtags/preact' (browser dist under the typecheck's browser
  condition) vs '../dist/preact.js'. Comparing a dist type to a src
  type is false (distinct declarations). Mutation (extra param on the
  browser toPreact) fails both assertions.
- Build wiring is config: no test-first.
- npm run gate exit 0: browser 454, ssr 128, preact-ssr 15, build 48,
  plugins 16, cli 23, hydration 136/17, hydration-dev 17.
- Not done here (spec seam 4, not in this ticket's checklist): a
  built-asset isolation check that dist/preact.browser*.js holds no
  render support. Checked by grep manually: none.

---
<!-- nightralph:entry ticket=preact-adapter:5 attempt=1 outcome=done -->
## 2026-11-08 22:21 -- preact-adapter/05 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.88. Checked items: "Bundles suite: each marker is found in its named control file, and the test output names that file.", "Bundles suite: the render support marker is absent from the browser adapter entry, each chunk it imports, and its min build, with one assertion per file.", "Bundles suite: the `preact-render-to-string` marker is absent from both browser adapter files.", "Bundles suite: no non-adapter `dist` entry or its chunks imports `preact`, with one assertion per file.", "A marker missing from its control file fails with a message saying the marker is stale (verified with a temporary bogus marker during development, not committed).", "`npm run gate` runs the suite and passes.".

### Agent notes
# Ticket 05 notes

- test/bundles.ts: MARKERS table {name, marker, control[], checked[]};
  withChunks(entry) follows relative `from`/`import` specifiers
  (handles minified `from"./x"`). Run via `npm run test:bundles`
  (esbuild cjs | node); added to gate right after `size`.
- Markers: `&#39;` (render-support escaper; its code is in a shared
  chunk, so the control is render-support.js + chunks);
  `"preact-render-to-string"` -- dist/preact.js does NOT import it, so
  the control is node_modules/preact-render-to-string/package.json
  (proves the specifier's spelling); `"preact"` (quoted, matches both
  `from "preact"` and minified `from"preact"`), control dist/preact.js.
- Suite was green on first run (split already held). Red verified by:
  importing render-support in src/preact.browser.ts + rebuild (fails on
  the chunk and the min file), appending prts import to
  preact.browser.min.js and `import "preact"` to dist/util.js (each
  failed exactly there), and a bogus marker (stale message naming the
  control files). All reverted, dist rebuilt.
- `npm pkg set` reorders peerDependencies; reverted that churn.

---
<!-- nightralph:entry ticket=preact-adapter:6 attempt=1 outcome=done -->
## 2026-11-08 22:23 -- preact-adapter/06 attempt 1 -- done

Effort: medium. Agent exit: 0. Subagents: 0. Cost: $0.79. Checked items: "`npm run build && npm run inject-size` fills the `microtags/preact` row without throwing.", "The README table of contents includes the `microtags/preact` section, and the README contains no em dashes.", "`npm run gate` passes.".

### Agent notes
# Ticket 06 notes

Docs/config ticket: no test-first. inject-size and README are release
tooling and docs; the user rules forbid tests for docs, and the
acceptance checks are command runs.

## Item 1: size row
- README table row with `<!-- size:preact -->` markers; MARKERS entry in
  scripts/inject-size.ts keyed on `microtags/preact (browser)` (the
  .size-limit.js name). `npm run build && npm run inject-size` printed
  0.44 KB for it. Kept the new row filled; restored the two existing
  values (the `version` script refreshes them at release).

## Item 2: npm pack --dry-run lists all five preact files; no change.

## Items 3: README `### microtags/preact` section after render-support,
`npm run toc` adds it to the TOC. No em dashes or arrows in README.
Props-before-definition phrased as "a value that survives conversion to
an attribute string still arrives" (objects would not).

## Gate: npm run gate exit 0 (browser 454, ssr 128, preact-ssr 15, bundles 28, ...).

---
