# 13: Server-render code reachable only through a render link

**What to build:** The host-tag builder, the prop serializers and
attribute escaping move out of core into a separate server render
support module, registered by the mechanism ADR-009 chose. Core
records prop metadata (kind and coercer) and the render function, and
installs a minimal `render` static that delegates to the support
module once it has registered. Calling `render` before registration
throws an error naming the module to import. The server templater
registers the support module, and the browser templater registers it
when it creates a host. Code that calls a component's `render` static
directly imports the support subpath once; the README documents this
breaking change.

The core size budget is lowered to the new measured size rounded up to
the next 0.05 kB, recorded in ADR-009. ADR-005's "core budget stays at
3.5 kB" gets a note pointing at ADR-009, and its claim that a browser
bundle holds hydration code only is amended. ADR-007's claim that core
grows "only by the prop accessors" is corrected. AGENTS.md's "Builder
and serialization" section is rewritten for the split, and the rule
for new coercer types points at the support module.

Source: spec section "Server-render code out of core's define path
(finding 8, goal 5)".

**Blocked by:** 12 (mechanism and numbers), 02 (attribute parity edits
the host-rendering path this moves), 05 (children marker emission in
the server templater), 07 (Markup brand in both templaters)

**Touches:** `src/builders.ts` (`_renderHost`, `_serializerFor`,
`_escAttr`, `staticRender`, `withProps` metadata), a new support module
under `src/` with a package.json `exports` entry and inclusion in
`build-cjs`, `build-esm` and `build-esm:min`, `src/htm.ts`,
`src/htm.browser.ts`, `src/index.ts`, `test/ssr.ts`, `test/index.ts`,
`test/types.ts`, `.size-limit.js`, README, AGENTS.md,
`docs/adr/ADR-005-*.md`, `docs/adr/ADR-007-client-templater.md`,
`docs/adr/ADR-009-*.md`

**Status:** done

- [x] Calling a component's `render` static with no templater and no
      support import throws an error that names the support module
- [x] After importing the server templater, `render` produces the same
      host HTML as before, and every existing SSR exact-string
      assertion passes unchanged
- [x] After the browser templater creates a host, `render` works
      without a separate support import
- [x] Core's size-limit entry is lowered to the ADR-009 number and
      `npm run size` passes
- [x] `npm run build`, `npm run test:ssr`, `npm test`,
      `npm run test:hydration` and `npm run lint` pass
