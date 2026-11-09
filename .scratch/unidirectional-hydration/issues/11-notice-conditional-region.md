# 11: Notice as a conditional region

**What to build:** On the notice route, the notice is shown by a
conditional reactive region driven by `noticeOpen` in state. The page's
show button has an `on<event>` handler that calls the `State` function to
open the notice. The notice's dismiss button emits an event; the page's
handler calls the `State` function to dismiss it. The notice no longer
removes its own host, and the page has no `innerHTML` assignment or
manual listener. The notice keeps its render link (`client: true`),
because the browser creates it.

**Blocked by:** 10

**Touches:** `example-hydration/components/notice.ts` (`Notice`),
`example-hydration/pages/` (notice page),
`example-hydration/client/index.ts` (remove any remaining notice code),
`test/e2e/hydration.spec.ts`, `test/hydration.ts`, `test/index.ts` cases
that import the notice

**Status:** done

- [x] The notice route's server response contains no notice host when
      `noticeOpen` is false, and its state script says so
- [x] Clicking the show button adds one notice host to the page
- [x] Clicking dismiss removes the notice host
- [x] The notice can be opened again after being dismissed
- [x] The notice component dispatches a dismiss event and does not remove
      its own host (browser suite: the host is still connected after the
      button click when no handler acts)
- [x] The client entry contains no `addEventListener` or `innerHTML` use
      outside the assertions harness and reveal helper
- [x] The runtime assertions contain no FAIL
- [x] `npm test`, `npm run test:hydration`, and `npm run test:e2e` pass
