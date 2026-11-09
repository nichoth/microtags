# 14: Stripping drops the support module from the client

**What to build:** The `microtags/build` transform injects an import
of the server render support module into any client module where it
keeps a render link, so kept components still render in the browser.
A module where every render link was stripped gets no such import, and
a client bundle with no templater import then contains none of the
host-tag, serializer or escaping code. The check is an observable
bundle property (the support module absent from the bundler's metafile,
or size against a stripped-and-unused baseline), not minified
identifier names.

Repeat the spec's end measurements: core, `microtags/htm`, the browser
templater, the example client with stripping on and off, and the
all-stripped fixture app. Record the final numbers in ADR-009.

Source: spec section "Server-render code out of core's define path
(finding 8, goal 5)", the transform part.

**Blocked by:** 13

**Touches:** `src/build.ts` (import injection when a render link is
kept, including under `cascade`), `src/esbuild.ts` and `src/vite.ts`
only if they need to forward anything, `test/build.ts`,
`test/plugins.ts`, new fixtures under `test/fixtures/`,
`docs/adr/ADR-009-*.md` (final measurements), README

**Status:** done

- [x] Transforming a module with a kept render link adds exactly one
      support import, and transforming it again adds no second one
- [x] Transforming a module where every render link is stripped adds
      no support import, including after cascade
- [x] Bundling an all-stripped fixture with the esbuild plugin yields a
      metafile with no support module input, and a kept-render fixture
      yields one with it
- [x] The example client still renders Badge and Notice in the browser
      after a production build
- [x] `npm run test:build`, `npm run test:plugins`,
      `npm run test:hydration`, `npm run test:e2e` and `npm run size`
      pass
