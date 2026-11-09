# 04: Morph hardening: duplicate keys throw, moveBefore guarded

**What to build:** Two fixes to the browser morph. First, when a
reactive region's new items contain the same `key` twice, the morph
throws an error naming the key, so a list bug fails at the source
instead of matching the wrong node. The check is on the new items, not
on existing DOM, so server HTML with repeated keys fails on the first
morph of that region. Second, the move step calls `moveBefore` only
when the parent is connected and inside a try, falling back to
`insertBefore` when it throws, so an unexpected throw from the browser
never breaks a render.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.browser.ts` (`_morph`: the key collection loop
and the placement loop inside `_dom`), `test/index.ts`.

**Status:** done

- [x] Browser suite: a region returning two items with the same `key`
      throws, and the error message contains the key.
- [x] Browser suite: a region whose items have distinct keys still
      morphs and keeps existing nodes (existing keyed tests pass).
- [x] Browser suite: with the parent's `moveBefore` shadowed by a
      function that throws, a keyed reorder still produces the new
      order.
- [x] Browser suite: with the parent's `moveBefore` shadowed by
      `undefined`, a keyed reorder still produces the new order.
