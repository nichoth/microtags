# 02: Templaters skip invalid attribute names

**What to build:** A spread of attributes whose key is not a valid HTML
attribute name cannot break out of a tag on the server or crash `mount`
in the browser. A valid name starts with a letter, `_` or `:`, followed
by letters, digits, `-`, `_`, `:` or `.`. Any other key is skipped
silently, in both templaters, on every path that writes attributes:
server plain elements, server extra attributes passed to a component,
browser `String()`, browser create, browser patch and browser adopt.
Skipping rather than throwing is deliberate, since the realistic source
is user data in a spread and that must not crash a request. The `key`
attribute is unchanged.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (the attribute loops in `h` for plain
elements and for component extra attrs), `src/htm.browser.ts` (`_str`,
`_compArgs`, `_bindEl`, `_setAttr`), `test/ssr.ts`, `test/index.ts`.
The host tag serializer in `src/builders.ts` is ticket 03, not this
one.

**Status:** done

- [x] SSR suite: `html` with a spread holding an invalid key (for
      example one containing `"` and a space) emits no attribute for
      it, while a valid key in the same spread is emitted.
- [x] SSR suite: a component given an invalid non-prop attribute name
      through the templater passes nothing for it to the host tag.
- [x] SSR suite: static pages stay byte-identical.
- [x] Browser suite: `mount` with a spread holding an invalid key does
      not throw, the element has no such attribute, and the valid key
      in the same spread is present.
- [x] Browser suite: a signal-valued attribute with an invalid name is
      never written on re-render.
