# 10: Client entry mounts the layout; counter driven by state

**What to build:** The browser starts from exactly what the server
rendered. The client entry reads the state script and calls `State` with
it. If the script is absent it uses defaults; if the JSON is malformed it
throws. It picks the page from the route table and mounts the layout into
the root, adopting the server's DOM. It contains no DOM manipulation
other than the runtime assertions harness and the reveal helper.

The counter becomes a pure view of state. One `count` prop replaces
`start`, and the "start at" line is removed. It holds no signal of its
own. Its buttons emit `increment` and `decrement` events with no detail;
the index page passes `count` from state and handlers that call the
`State` functions. The counter's setup drives the nested badge by binding
a derived value to the badge host's `label` prop. Its render link stays
stripped.

The badge's setup binds `label` to its text element through a ref
(`r.one<T>()`, not a tag query). The badge is kept in the browser bundle
(`client: true`), because the list page will create badges.

Runtime assertions: the badge assertion flips to "render is kept"; the
counter assertion stays as the proof that stripping still works.

Do not treat the counter host's `count` attribute as the current value
after mount; a signal is assigned to the prop accessor.

**Blocked by:** 07, 09

**Touches:** `example-hydration/client/index.ts`,
`example-hydration/components/counter.ts` (`Counter`),
`example-hydration/components/badge.ts` (`Badge`),
`example-hydration/pages/` (index page, layout),
`example-hydration/state.ts` (used, not changed),
`example-hydration/vite.config.ts` (keep list / alias if needed),
`test/e2e/hydration.spec.ts`, `test/hydration.ts`, `test/index.ts` and
`test/ssr.ts` cases that import the counter or badge

**Status:** done

- [x] With `?count=12`, the page loads showing a count derived from 12,
      and clicking increment changes it to the next value (compare
      against the parsed state script, not literal page text)
- [x] Clicking decrement lowers the count
- [x] The counter host is the same element before and after a click
      (identity check via an element handle)
- [x] Loading the page creates no duplicate hosts: one counter host
      before and after the client entry runs
- [x] The runtime assertions contain no FAIL; the counter's render link
      is absent and the badge's is a function
- [x] The counter dispatches `increment` and `decrement` events and holds
      no count of its own: setting its `count` prop from outside changes
      what it shows (browser suite)
- [x] Assigning the badge's `label` prop updates its text element
      (browser suite)
- [x] The server response for the index route no longer contains a
      `start` attribute on the counter host
- [x] `npm test`, `npm run test:ssr`, `npm run test:hydration`, and
      `npm run test:e2e` pass
