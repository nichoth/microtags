# 07: Markup from another package copy still mounts

**What to build:** Both templaters brand `Markup` with a registry
symbol (`Symbol.for('microtags.markup')`) and check the brand instead
of `instanceof`. Markup produced by a different copy of the package
(for example `dist/htm.browser.js` mounted with `src/htm.browser.ts`)
renders as elements rather than as escaped text. The AGENTS.md note
about two copies in the browser tests is relaxed; tests may keep
importing `mount` from the package.

If the browser templater exceeds its size limit, raise the limit to
the measured size rounded up to the next 0.05 kB and record it in the
ADR-007 note.

Source: spec section "Markup identity (finding 12)".

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (`Markup`, the `instanceof` checks in `h` and
`html`), `src/htm.browser.ts` (`Markup`, `_str`, `_items`, `html`),
`test/index.ts`, `test/ssr.ts`, AGENTS.md (example hydration section),
`.size-limit.js` if needed

**Status:** done

- [x] `html` markup from `dist/htm.browser.js` passed to `mount` from
      the source browser templater produces element nodes, not text
- [x] Markup from a second copy nested inside server templater markup is
      not double-escaped
- [x] `npm run test:ssr`, `npm test` and `npm run size` pass
