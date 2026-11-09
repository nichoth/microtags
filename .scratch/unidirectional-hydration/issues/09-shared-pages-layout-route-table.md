# 09: Shared pages, layout, and route table rendered by the server

**What to build:** The server renders each route from a page function
that takes the request's state, wrapped in a layout, both from a new
directory shared by server and browser. A route table in that directory
maps a route to its page, including the not-found page; both sides will
use it. The server-only route bodies module is removed.

The layout renders the navigation links and binds `aria-current` to
`route`, so a visitor sees the current page marked. Routing stays on the
server: every link is a full page load. The navigation moves out of the
scaffold. The scaffold body holds a root element containing the page
marker, then the runtime assertions section, the state marker, and the
module script.

The handler renders the layout around the page for the route and converts
the markup to a string. The options tests inject today (heading and
label) become plain arguments to the page function, not state.

Pages import the templater by package name (`microtags/htm`) and contain
no builder chains, so the stripping filter does not need to match them.

In this ticket the pages keep today's page content (same components and
props); the counter, notice, and list rework is tickets 10 to 12. The
existing client entry keeps working: it must null-check anything a route
does not render.

**Blocked by:** 04, 08

**Touches:** `example-hydration/pages/` (new: one page per route, layout,
route table), `example-hydration/server/routes.ts` (removed),
`example-hydration/server/app.ts`, `example-hydration/server/ssr.ts`,
`example-hydration/index.html`, `example-hydration/client/index.ts`
(null checks only), `example-hydration/client/index.css` only if the
root wrapper requires it, `tsconfig.typecheck.json` /
`example-hydration/server/tsconfig.json` includes, `test/hydration.ts`,
`test/hydration-dev.ts`, `test/hydration-listen.ts`, `test/ssr.ts` and
`test/index.ts` imports of moved modules, `test/e2e/hydration.spec.ts`

**Status:** done

- [x] Every route's response has the root element containing the
      navigation and the page, and the scaffold file itself contains no
      navigation
- [x] Exactly one navigation link carries `aria-current` on each known
      route, and it is the link for that route; none on the 404
- [x] The route table returns the not-found page for an unknown route
- [x] The index page accepts heading and label as arguments and the
      existing escaping test still passes through them
- [x] The state script from ticket 08 is still present and round-trips
- [x] `server/routes.ts` no longer exists and nothing imports it
- [x] The existing e2e suite passes: nav links reach every route and the
      runtime assertions contain no FAIL
- [x] `npm run test:hydration`, `npm run test:hydration-dev`,
      `npm run typecheck`, and `npm run typecheck:hydration` pass
