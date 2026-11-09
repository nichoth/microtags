# 02: ADR-010, Preact owns the host and the element owns its children

**What to build:** A new ADR recording the decision behind
`microtags/preact` (spec: `.scratch/preact-adapter/spec.md`). It covers
context, decision, trade-offs and consequences:

- Context: Preact's `renderToString` emits an empty host because it
  does not know the component's markup, and Preact 10's `hydrate`
  removes every existing child it has no vnode for, except under an
  element whose vnode carries `dangerouslySetInnerHTML`.
- Decision: Preact owns the host tag and its attributes, and the
  element owns the host's children. On the server the adapter fills
  the host from the component's render parts. In the browser it gives
  the host one shared, fixed, empty `__html`. While hydrating, Preact
  neither writes `innerHTML` nor removes existing children. Outside
  hydration it writes `innerHTML` only when `__html` changes, so a
  fixed value is written at most once, on the first non-hydrating
  render. Both branches were verified in Preact 10.29.7, and the dev
  dependency is pinned so a change arrives as a deliberate bump that
  the browser tests check.
- Rejected alternatives: a bare host tag (empty server output, and
  hydrate deletes server children); a global `options.vnode` hook that
  injects inner HTML into every microtags tag (implicit, global, and
  touches every vnode); a per-call `__html` that changes with props
  (Preact would write it over live DOM, destroying element state).
- Known edge: if the element is not yet defined when Preact first
  assigns a prop, Preact sets an attribute instead of a property. The
  adapter does not work around this, because declared props read their
  attribute at connect time.
- Consequences: no Preact children (slotting vnodes into element-owned
  markup is out of scope); the browser build carries no render code;
  `preact` is an optional peer dependency that core and every other
  entry never import.

No ADR is superseded. Relate it to ADR-005 and ADR-009 (render links
and render support) and ADR-004 (client size).

**Blocked by:** None (can start immediately)

**Touches:** `docs/adr/ADR-010-preact-adapter-ownership-split.md`
(new), `docs/adr/INDEX.md` (new row using the link-reference style of
rows 006 to 009).

**Status:** done

- [x] `docs/adr/ADR-010-preact-adapter-ownership-split.md` exists with
      context, decision, trade-offs and consequences sections covering
      every point above.
- [x] `docs/adr/INDEX.md` lists ADR-010 dated 2026-11-08.
- [x] The ADR uses the `CONTEXT.md` meanings of **Hydration** (the
      intent) and **Adopt** (the mechanism), and says the adapter keeps
      Preact from undoing hydration without adopting anything itself.
- [x] `npm run lint` passes; the ADR contains no em dashes and no
      arrow characters.
