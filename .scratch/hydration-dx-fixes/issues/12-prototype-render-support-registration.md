# 12: Prototype render-support registration and write ADR-009

**What to build:** A measured decision on how the server render
support module (host tag builder, prop serializers, attribute
escaping) registers itself with core, so that a client bundle with
every render link stripped and no templater import contains none of
that code. Prototype the candidates named in the spec (a side-effect
subpath, a setter exported from core, a module-level hook) on a
scratch copy, bundle a fixture with every render link stripped for
each, and measure core, the browser templater and the fixture bundle.

Record the chosen mechanism, the measurements and the trade-offs in a
new ADR-009 "Server render support loaded through the render link",
add its row to the ADR index, and note that ADR-005 is amended by it.
State plainly that the example keeps Badge and Notice and so still
ships the support module; the win is for apps that strip every render
link. No core change lands in this ticket.

Source: spec section "Server-render code out of core's define path
(finding 8, goal 5)".

**Blocked by:** None (can start immediately)

**Touches:** `docs/adr/ADR-009-server-render-support-through-render-link.md`
(new), `docs/adr/INDEX.md`; prototypes stay in a scratch worktree or
under `.scratch/hydration-dx-fixes/` and are not committed to `src/`

**Status:** done

- [x] ADR-009 exists, is listed in the ADR index, and names one
      registration mechanism with the reasons the others lost
- [x] ADR-009 records measured sizes for core, the browser templater,
      and an all-stripped fixture bundle for the chosen mechanism, using
      the review's method
- [x] ADR-009 states the breaking change for code that calls a
      component's `render` static without a templater
- [x] `npm run lint` passes and `src/` is unchanged
