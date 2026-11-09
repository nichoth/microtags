<!-- nightralph:review from=205d9dd5aa21d195141c3540058475ba9967fdd9 to=b85904e9315c4384f1d8d65fb26afa36139dee16 status=fixed -->
## 2026-10-14 21:49 -- review 205d9dd..b85904e -- 1 of 3 fixed
- [ ] Adopting a `raw()` that starts with text, right after a text child, consumes the next element and leaves later siblings unbound
    src/htm.browser.ts:538-545. The server output `<p>Price: &euro;5<button>go</button></p>` parses to one merged text node `"Price: €5"`, then `<button>`. Mounting `html`<p>Price: ${raw('&euro;5')}<button onclick=${fn}>go</button></p>`` over it goes like this: the text item `"Price: "` consumes the merged text node, so `n` is now `<button>`. The raw span's first node is text, and `<button>` is an element that `_skip` would not skip, so the pre-span loop stops and `n = n.nextSibling` consumes the button as if it were the raw text. The button item then finds no node: it warns "found none", the lookahead fails, and the listener is never attached. I confirmed this in tapout with a probe: 1 warning, 0 clicks. The span logic assumes the span's first DOM node is separate from the item before it, but the browser merges adjacent text. A text-leading raw after static or interpolated text (entities, `raw(md)` output) is common. The existing tests (test/index.ts:2616, 2631) only cover a raw that is the first child, so they miss it. Fix: a text-leading span should not consume a non-text node, e.g. when `n` is not a text node, treat the leading text as already merged into the previous item. Also add a test with text before the raw.
- [x] AGENTS.md has duplicated and dangling fragments left over from merging ticket notes
    AGENTS.md:75-80. "Both suites must stay green" appears twice: once ending "tapout serves on a fixed port...", then again as a sentence fragment starting "suites must stay green: `npm run gate`...". AGENTS.md:180-185 starts a paragraph mid-sentence with "(`<!--[c-->` for component children) via `innerHTML`, since browser `String(markup)` emits no markers." That repeats the paragraph above it, and the port-8123 note appears three times. The file is the contract for future agents, and these broken sentences make the gate and the adoption-fixture rules ambiguous to read.
- [ ] The mismatch lookahead can jump past the range's `end` and adopt an element outside the range
    src/htm.browser.ts:584-590. The loop steps over a comment whose data starts with `[` via `_close(m).nextSibling`, but only checks `m !== end` before each step. Take an adopted region range with `end` = the region's `]`. If a non-marker comment starting with `[` (e.g. `<!--[if IE]-->`) or an unbalanced `[` marker sits inside that range, `_close` matches the range's own `end`. The walk continues from `end.nextSibling`, outside the region, so a sibling after the region with the expected tag gets adopted and bound by this region's markup. `_skip` treats only `[` as a marker, but this check uses `data[0] === '['`. That is inconsistent and also matches `[c` and arbitrary comments. Fix: stop when `_close(m)` returns `end` (or is not before `end`), and match exactly `[` or `[c`.

### Fix
- attempts: 1 of 4
- effort: medium
- agent exit code: 0
- result: merged

# Review-fix notes

## Finding 1: text-leading raw() after text (done)

- `src/htm.browser.ts` `_adopt` raw branch: a parsed text node only
  advances the cursor when the DOM node is text. Adjacent texts cannot
  occur inside one parsed fragment, so a text item meeting a non-text
  node means its text merged into the text item before it.
- Test: `test/index.ts` "adopt: a text-leading raw() after text keeps
  the next button" (red: 1 warning, 0 clicks; green after fix).
- Browser templater size is 5300 B against a 5.3 kB limit (exactly at
  the limit, passing).

## Finding 3: lookahead past `end` (done)

- `_adopt` lookahead now steps over only comments whose data is exactly
  `[` or `[c` (regex `/^\[c?$/`), and does not step past `m` when
  `_close` returned `end`.
- Test: "adopt: mismatch lookahead stays inside a region range" uses a
  `<!--[if IE]-->` comment inside an adopted region (red: the region's
  listener was bound to the `<b>` after the region).
- An unbalanced `[` inside a range cannot be built as a passing
  fixture: the outer `_close` then fails too and the region warns
  "missing region markers". The `end` guard is defensive.
- Size: browser templater 5306 B, over the 5.3 kB limit; raised to
  5.35 kB per the spec rule, recorded in `.size-limit.js` and an
  ADR-007 note. A shared `_open` helper was tried and was larger.

## Finding 2: AGENTS.md fragments (done)

- Merged the two "suites must stay green" sentences into one paragraph
  (gate, port, t.throws). Folded the dangling `(<!--[c-->` ...)`
  paragraph into the adoption paragraph. The port-8123 note now appears
  once (the teardown section's copy was removed).
- Added the raw-span text-merge and lookahead-boundary gotchas to the
  adoption paragraph as reusable learnings.
- Docs only, no test (global rule: no tests for docs).
---
