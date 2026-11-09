# 11: Example page visible without JS and quiet under hydration

**What to build:** The server-rendered page is visible even if the
client script fails to load, is blocked, or throws. The `reduce-fouce`
class, its CSS rule and the client helper that removes it are deleted.
Badge's setup writes its text only when the current text differs from
the label, and the example README's component notes describe that
pattern for any setup that writes server-rendered content. The client
entry imports leaf components (Badge, Notice) before components that
nest them, with a README note explaining that cascade changes module
evaluation order in the stripped build.

Source: spec section "Example app", findings 7, 10 and 13.

**Blocked by:** 01 (e2e must be green), 03 (the no-attribute-writes
e2e assertion needs passive adoption)

**Touches:** `example-hydration/index.html`,
`example-hydration/client/index.css`, `example-hydration/client/util.ts`
(delete or trim), `example-hydration/client/index.ts` (import order,
drop the helper call), `example-hydration/components/badge.ts`,
`example-hydration/README.md` (then `npm run toc:hydration`),
`test/e2e/hydration.spec.ts`

**Status:** done

- [x] With every `.js` request aborted, the document's computed opacity
      is not 0 after load on `/`
- [x] On `/list`, a MutationObserver started at `interactive` sees no
      text node replacement inside badge hosts during hydration
- [x] On `/list`, the same observer sees no attribute mutations during
      hydration
- [x] The client entry's import order places Badge and Notice before
      Counter, and the stripped client still asserts Counter has no
      render
- [x] `npm run test:e2e`, `npm run test:hydration` and `npm run lint`
      pass
