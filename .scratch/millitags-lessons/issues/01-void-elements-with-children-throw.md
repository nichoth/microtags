# 01: Void elements with children throw

**What to build:** An app author who writes an unclosed void element
such as `<input type="text">` in a template gets an error at template
evaluation time, on both the server and in the browser, instead of the
rest of the page silently vanishing. The error names the tag and the
self-closing form (for example `<input />`) and says that an unclosed
void element swallows what follows it. A self-closed void element keeps
working as it does today. Whitespace text counts as a child, since
`htm` hands it over as one. The README paragraph on void elements
changes from describing the swallowing to saying the templater throws.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (`h`, `VOID`), `src/htm.browser.ts` (`h`,
`VOID`), `README.md` (the "Void elements" paragraph under
`microtags/htm`), `test/ssr.ts`, `test/index.ts`. The two `VOID` sets
stay as they are and must remain identical.

**Status:** done

- [x] SSR suite: `html` with an unclosed void element that has children
      throws, and the error message contains the tag name.
- [x] SSR suite: `html` with the same void element self-closed does not
      throw and emits no closing tag (existing behaviour kept).
- [x] SSR suite: static pages used by the exact-string assertions stay
      byte-identical.
- [x] Browser suite: the browser `html` throws on a void element with
      children, and the error message contains the tag name.
- [x] Browser suite: `mount` of markup with self-closed void elements
      still creates them (existing void-element test still passes).
