# 10: Example server renders only from serialized state

**What to build:** Every value a page function reads comes from
`AppState` and is serialized, so the browser mounts exactly what the
server rendered. `createApp` loses the server-only index page options,
and tests that set them switch to state. A request path outside the
prefix is given the not-found route, so it renders the not-found page
with a 404 rather than a real page with a 404 status. `/index.html`
under the prefix maps to route `/`, so the nav marks the home link
current.

Source: spec section "Example app", findings 6, 11 and 15.

**Blocked by:** 01 (hydration suites must be green)

**Touches:** `example-hydration/server/app.ts` (`createApp` options,
`stateFor`, route handlers), `example-hydration/state.ts`,
`example-hydration/pages/index.ts` and `pages/routes.ts`,
`example-hydration/client/index.ts` if it passes page inputs,
`test/hydration.ts`, `test/hydration-dev.ts`,
`example-hydration/README.md` (then `npm run toc:hydration`)

**Status:** done

- [x] `createApp` accepts no page-content options, and any formerly
      optional heading or label comes from the serialized state script
- [x] A request for a path outside the prefix returns 404 and its
      serialized state carries the not-found route
- [x] A request for `/index.html` under the prefix renders the home
      link with the current-page attribute set
- [x] `npm run test:hydration`, `npm run test:hydration-dev` and the
      listener test pass
