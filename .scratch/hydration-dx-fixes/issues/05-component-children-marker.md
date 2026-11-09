# 05: Component children get their own marker

**What to build:** The server templater wraps non-empty component
children in a distinct opening marker (`<!--[c-->`) instead of the
region marker, closed by the usual `<!--]-->`. The browser locates a
host's children range by that marker, matching its close by nesting
depth, so a kept component whose own render has a reactive region
before its children still has its child listeners bound. The browser
`String()` path emits no markers, as today.

The glossary entry for **Reactive region** and ADR-007 note the
separate children marker. Adoption fixtures and the SSR children
assertions change in this ticket.

If the browser templater exceeds its size limit, raise the limit to
the measured size rounded up to the next 0.05 kB and record it in the
ADR-007 note.

Source: spec section "Adoption alignment (finding 4)", the children
part.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (component children wrapping), `src/htm.browser.ts`
(`_range` and the marker checks in the adoption walker and `_skip`),
`test/ssr.ts` (children marker assertions), `test/index.ts` (adoption
fixtures), `CONTEXT.md` (Reactive region), `docs/adr/ADR-007-client-templater.md`,
`.size-limit.js` if needed

**Status:** done

- [x] Server output for a component with non-empty children wraps them
      in `<!--[c-->` and `<!--]-->`, and a component with no children
      emits no children markers
- [x] A kept component whose render has a reactive region before its
      children is adopted so that a button inside the children fires
      its listener
- [x] A host with nested hosts in its children still resolves the
      outer children range (depth matching)
- [x] Existing exact-string static page assertions in the SSR suite
      pass unchanged
- [x] `npm run test:ssr`, `npm test` and `npm run size` pass
