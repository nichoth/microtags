# 06: Form controls bind DOM properties on create and patch

**What to build:** In the browser templater, `value`, `checked` and
`selected` on `input`, `textarea`, `select` and `option` are control
properties. They are written as DOM properties, never as attributes,
when an element is created and when it is patched. A per-element record
holds the last value each control property was bound to, and a write
happens only when the bound value differs from the recorded one by
`Object.is`. So an unrelated re-render never overwrites what the visitor
typed, and a changed bound value always wins. `value` writes `''` for
`null` and `undefined` and the string form otherwise; `checked` and
`selected` write the boolean form. For `select`, the `value` property
is written after the element's children exist, so the create path
orders children before control properties. All other attributes are
unchanged, and the `String()` path still emits these as attributes in
static HTML.

The adopt path is ticket 07.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.browser.ts` (`_setAttr`, `_bindEl`, `_create`,
`_patch`; a per-element record, for example a `WeakMap`), `test/index.ts`.
The pair of tests for each control must be in the same test, because
"user edit survives" can pass by accident without "bound value wins".

**Status:** done

- [x] Browser suite: a mounted input with a bound `value` has that
      value as a property and no `value` attribute change is needed
      for it to show.
- [x] Browser suite, one test: after the visitor edits the input (set
      `value`, dispatch `input`), re-rendering by changing an unrelated
      signal leaves the edit in place; then changing the bound signal
      replaces the edit with the new bound value.
- [x] Browser suite, one test: the same pair for a checkbox's
      `checked`, where the visitor toggles it, an unrelated re-render
      leaves it, and a changed bound value wins.
- [x] Browser suite: a `select` created with a bound `value` has the
      matching option selected immediately after mount.
- [x] Browser suite: binding `null` to `value` yields an empty string
      property.
- [x] Browser suite: `String()` of the same markup still contains the
      control values as attributes.
