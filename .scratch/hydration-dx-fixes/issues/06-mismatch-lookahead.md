# 06: Mismatch costs one warning, not every sibling

**What to build:** On a tag mismatch during adoption, the walker looks
ahead through the later sibling elements in the same range for the
first element with the expected tag. If found, it adopts that element
and leaves the skipped server nodes untouched. If none is found, it
warns and does not advance the DOM cursor, so the next markup item is
tried against the same node. One extra or missing server node costs
one warning and later siblings stay bound.

Warnings stay unconditional. ADR-007 is corrected from "warns in
development" to "always warns" and describes the lookahead.

If the browser templater exceeds its size limit, raise the limit to
the measured size rounded up to the next 0.05 kB and record it in the
ADR-007 note.

Source: spec section "Mismatch recovery (finding 9)".

**Blocked by:** 04 (raw adoption alignment; both change how the
adoption cursor advances)

**Touches:** `src/htm.browser.ts` (the mismatch branch of the adoption
walker), `test/index.ts`, `docs/adr/ADR-007-client-templater.md`,
`.size-limit.js` if needed

**Status:** done

- [x] Server DOM `<h1><p><button>` adopted against markup `<p><button>`
      logs one warning at most and the button's listener fires
- [x] Server DOM `<p><button>` adopted against markup `<h1><p><button>`
      logs one warning and the button's listener fires
- [x] The skipped server nodes are the same node objects after adoption
- [x] `npm test` and `npm run size` pass
