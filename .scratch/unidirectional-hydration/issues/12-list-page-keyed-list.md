# 12: List page as a keyed list

**What to build:** The list route renders the labels signal from state as
a keyed list of badges, with controls to add and remove a label. The
controls use `on<event>` handlers that call the `State` functions (add
and remove a label). The browser creates new badges, which is why the
badge is kept. Existing badge hosts keep their identity when another item
is added or removed.

**Blocked by:** 10

**Touches:** `example-hydration/pages/` (list page),
`example-hydration/state.ts` (labels and its mutators, used),
`example-hydration/client/index.css` only if the controls need styling
(use existing variables), `test/e2e/hydration.spec.ts`,
`test/hydration.ts`

**Status:** done

- [x] The list route's server response has one keyed item per label in
      the state script
- [x] Adding a label increases the number of badge hosts by one
- [x] Removing a label decreases the number of badge hosts by one, and
      the removed item's key is gone
- [x] A badge host that was present before an add or remove is the same
      element afterwards (identity check via an element handle)
- [x] Loading the page adopts the server's badges: the host count is the
      same before and after the client entry runs
- [x] The runtime assertions contain no FAIL
- [x] `npm run test:hydration` and `npm run test:e2e` pass
