# 03: `html` returns markup (server)

**What to build:** The templater's `html` returns opaque **markup**
(`Markup` as the type name) instead of a string. Converting markup to a
string (`String(m)` / `toString()`) yields the HTML. Markup, the output of
a render function, and `raw` remain trusted strings for escaping: nesting
never double-escapes. A render function may return markup directly. This
is a breaking change, so every existing caller that passes templater
output where a string is required converts explicitly. Output bytes do not
change in this ticket.

The glossary reserves "template" for the native `<template>` element; do
not name the type `Template`.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (`html`, `h`, `raw`, `_Trusted`, exported
`Markup` type), `src/builders.ts` (`RenderFn` return type, static
`render`, `children`), `test/ssr.ts`, `test/index.ts`, `test/build.ts`,
`test/types.ts`, `example-hydration/server/routes.ts`,
`example-hydration/server/app.ts`,
`example-hydration/client/index.ts` (the `innerHTML` assignment),
`example-hydration/components/*.ts`, `example/` only where a string
conversion is forced

**Status:** done

- [x] `html` returns a value typed `Markup` that is not assignable to
      `string` in the type tests
- [x] `String(html\`...\`)` equals the string the same call returned
      before this change
- [x] Markup interpolated into another `html` call is not escaped again
- [x] An array of markup in child position flattens as before
- [x] A render function that returns markup produces the same host HTML
      as one that returns the equivalent string
- [x] A declared string prop is still escaped exactly once
- [x] `npm test`, `npm run test:ssr`, `npm run test:build`,
      `npm run test:hydration`, and `npm run typecheck:hydration` pass
