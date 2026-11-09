# 07: Adopted form controls compare against the live DOM

**What to build:** When `mount` adopts server-rendered form controls,
the first comparison for each control property is against the live DOM
property, not the per-element record from ticket 06. An adopted input
whose server attribute already matches the bound value gets no property
write, and a value the visitor typed before hydration is untouched when
the bound value matches the server attribute. Later runs compare against
the record as in ticket 06. This keeps the hydration DX spec's passive
adoption rule for controls.

**Blocked by:** 06 (Form controls bind DOM properties on create and
patch), and the hydration DX spec's passive adoption ticket
(`.scratch/hydration-dx-fixes/spec.md`, "Passive adoption"). That spec
is not yet ticketed; when it is, record the ticket number here.

**Touches:** `src/htm.browser.ts` (`_adopt`, the control-property
write path from ticket 06), `test/index.ts`. Fixtures are built as
static HTML with markers via `innerHTML`, as existing adoption tests do.

**Status:** done

- [x] Browser suite: adopting an input whose `value` attribute equals
      the bound value produces no mutation seen by a MutationObserver
      attached before `mount`, and no property write (a dirty value set
      before `mount` stays).
- [x] Browser suite: adopting an input whose `value` attribute differs
      from the bound value sets the property to the bound value.
- [x] Browser suite: after adoption, the user-edit-survives and
      bound-value-wins pair from ticket 06 holds for the adopted input.
- [x] Browser suite: adopting a checked checkbox whose bound value is
      `true` produces no write; a bound `false` unchecks it.
