# 01: Components return their server render as parts

**What to build:** A component class with a render link gains a
`renderParts` static next to `render`. It takes the same arguments
(props, plus options `children` and `attrs`) and returns `{ tag, attrs,
html }`: the host tag name; an ordered record from attribute name to
serialized string, holding the declared props first and then the extra
`attrs`, filtered by the same attribute name check; and the inner HTML
string. A true boolean prop serializes to the empty string, as today.
A component without a render link has neither static.

Render support stays the only place that serializes. It gains a
`renderParts` function, registered under
`Symbol.for('microtags.renderParts')` beside the existing
`microtags.render` key, so any copy of core works with any copy of
render support (ADR-009). `renderHost` is rewritten to assemble its
string from the parts, and its output stays byte-identical. Without
render support loaded, `renderParts` throws an error naming
`microtags/render-support`, as `render` does.

Core is within about 20 B of its 4 kB size limit. Write both statics
through one shared helper that takes the symbol key, keep it to the
shortest equivalent code, then measure `dist/index.min.js` and raise
the core limit in `.size-limit.js` to the measured size rounded up to
the next 0.05 kB, recording the measurement in its comment, as the
existing entries do.

**Blocked by:** None (can start immediately)

**Touches:** `src/builders.ts` (`setup`, the `RenderRecord` path, a new
`RenderParts` type and `StaticRenderPartsFn`, `MicrotagElementClass`),
`src/index.ts` (type exports), `src/render-support.ts` (`renderParts`,
`renderHost`, `register`), `test/ssr.ts`,
`test/fixtures/render-unregistered.ts`, `test/types.ts`,
`.size-limit.js`, README (`builder.render` and
`microtags/render-support` sections), `CONTEXT.md` (a **Render parts**
term under "Rendering markup").

**Status:** done

- [x] SSR suite: for a component with number, string, boolean (true
      and false), json, schema, prop-only and null props, plus extra
      attrs and children, assembling `renderParts` output into a host
      string equals `render` output byte for byte.
- [x] SSR suite: `renderParts(...).attrs` lists declared props before
      extra attrs and contains no prop-only props, no null props, no
      false booleans and no extra attr whose name fails the attribute
      name check.
- [x] SSR suite: a true boolean prop appears in `attrs` with the empty
      string as its value.
- [x] SSR suite: a class with no render link (defined without one, and
      one whose render link the `microtags/build` transform stripped)
      has no `renderParts` static.
- [x] SSR suite: in the unregistered fixture process, `renderParts`
      throws an error naming `microtags/render-support`.
- [x] Every existing exact-string `render` assertion in `test/ssr.ts`
      and the parity cases in `test/parity.ts` still pass unchanged.
- [x] `test/types.ts`: `RenderParts` is importable from `'microtags'`,
      and `El.renderParts` returns it for a class from `setup`.
- [x] `npm run size` passes with the core limit raised only as far as
      the measured size requires.
