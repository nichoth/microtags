# 03: Adoption writes no static attributes

**What to build:** When `mount` adopts server-rendered DOM, it writes
nothing for static attribute values. Only function- or signal-valued
attributes are bound, and a bound attribute's first run during
adoption compares against the element's current attribute (and its
presence, for the remove case) and writes only when the value differs.
Later runs write as they do today. Iframes, video and audio no longer
reload when the page becomes interactive.

ADR-007 gets a correction saying adoption writes no attributes whose
values already match, so "binds, and creates no nodes" now holds for
attributes too.

If the browser templater exceeds its size limit, raise the limit to
the measured size rounded up to the next 0.05 kB and record it in the
ADR-007 note.

Source: spec section "Passive adoption (finding 3)".

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.browser.ts` (`_bindEl` and the adoption path
that calls it), `test/index.ts` (adoption fixtures built with
`innerHTML` and markers, a MutationObserver attached before `mount`),
`docs/adr/ADR-007-client-templater.md`, `.size-limit.js` if needed

**Status:** done

- [x] A MutationObserver attached before `mount` records no attribute
      mutations on adopted elements whose attributes are all static
- [x] A bound attribute whose current value already matches produces
      no attribute mutation during adoption
- [x] A bound attribute whose value differs is written once during
      adoption, and later signal changes still update it
- [x] An adopted `<iframe>` does not fire a second `load` event after
      `mount`
- [x] `npm test` and `npm run size` pass
