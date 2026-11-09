# 04: Adoption stays aligned across multi-node raw()

**What to build:** When adoption meets a `raw()` item, it consumes
exactly as many DOM nodes as the raw content parsed to, with no
whitespace or comment skipping inside that span. Skipping still applies
before and after the span. A button that follows a `raw()` value
holding several top-level nodes or whitespace between them gets its
listener bound. Server output for `raw()` does not change.

If the browser templater exceeds its size limit, raise the limit to
the measured size rounded up to the next 0.05 kB and record it in the
ADR-007 note.

Source: spec section "Adoption alignment (finding 4)", the `raw()`
part.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.browser.ts` (`_items` and the parsed-node branch
of the adoption walker), `test/index.ts`, `.size-limit.js` if needed

**Status:** done

- [x] After adopting markup with a `raw()` value that holds two
      elements separated by a newline, a following button's `onclick`
      fires
- [x] After adopting markup with a `raw()` value that holds text and an
      element, a following bound attribute updates on signal change
- [x] No adoption warning is logged for either case
- [x] Existing exact-string static page assertions in the SSR suite
      pass unchanged
- [x] `npm test` and `npm run size` pass
