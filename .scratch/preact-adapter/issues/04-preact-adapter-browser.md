# 04: `microtags/preact` hydrates and client-renders in the browser

**What to build:** The browser build of `microtags/preact`, selected by
a `browser` export condition listed first, the same way
`microtags/htm` splits. It exports the same `toPreact` with the same
type (from the module shared with ticket 03) and never imports render
support.

In the browser the adapter returns a host vnode with:

- the declared props as vnode props, so Preact assigns them as
  properties through the host's prop accessors;
- one `on<event-name>` function prop per mapped event, so Preact
  attaches the listener with the event name's case preserved, even
  while hydrating;
- the passthrough `class`, `id`, `aria-*` and `data-*` props;
- `dangerouslySetInnerHTML` set to one shared module constant whose
  `__html` is the empty string.

So during `hydrate` Preact leaves the host's children alone, later
renders never write `innerHTML`, and a client-only `render` empties the
host once and the element renders itself when it connects. Children
still throw, as in ticket 03. Props assigned before the element is
defined become attributes; that is the known edge recorded in ADR-010
and needs no workaround.

Add the browser source to `build-esm` and `build-esm:min`. The min
build bundles dependencies, so pass `--external:preact` for it, and
give the size-limit entry `ignore: ['preact']` so it measures the
adapter alone. Record the measured size in the entry's comment.

Browser tests import the browser source directly (as with
`src/htm.browser.ts`). Build hydrate fixtures from the component's
`render` static output placed with `innerHTML` (`test/index.ts` imports
the server templater, so render support is registered there).

**Blocked by:** 03

**Touches:** `src/preact.browser.ts` (new), the shared adapter types
module, `package.json` (`exports["./preact"].browser` with `types` and
`import`, listed first; `build-esm`, `build-esm:min`), `.size-limit.js`
(a `microtags/preact (browser)` entry for `dist/preact.browser.min.js`),
`test/index.ts` (or a new file it imports), `test/types.ts`,
`AGENTS.md` (extend the entry's section).

**Status:** done

- [x] Browser suite: after Preact's `hydrate` of the adapter over the
      component's server string, an inner node referenced before
      hydrate is the same node and still connected.
- [x] Browser suite: after hydrate, re-rendering with a changed
      declared prop leaves the same inner node in place, and the
      element's property returns the new value.
- [x] Browser suite: a value typed into an inner input before hydrate
      is still the input's value after hydrate.
- [x] Browser suite: with the full variant defined, Preact's `render`
      of the adapter into an empty container produces the component's
      inner markup, and a later re-render with a changed prop keeps the
      same inner nodes.
- [x] Browser suite: a mapped callback prop is called when the
      component emits the mapped event, both after hydrate and after a
      client-only render.
- [x] Browser suite: rendering the browser adapter with children
      throws an error containing the tag name.
- [x] `test/types.ts`: the browser build's `toPreact` type equals the
      default build's.
- [x] `npm run size` passes with the new browser adapter entry, and
      `npm run gate` passes.
