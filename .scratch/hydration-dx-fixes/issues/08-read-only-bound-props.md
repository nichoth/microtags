# 08: Writing to a bound prop throws

**What to build:** While a signal or computed is bound to a prop
through the host's prop accessor, calling the setup-context prop signal
with an argument throws an error naming the tag and the prop and
telling the author to emit an event instead. This holds in all builds.
Unbound props stay writable by their own component. Assigning to the
host's accessor from outside (state down) is unchanged, and attribute
changes while bound stay ignored.

The glossary entry for **Prop** and ADR-007 record that a bound prop
is read-only inside the component.

Source: spec section "Read-only bound props (finding 5)".

**Blocked by:** None (can start immediately)

**Touches:** `src/factory.ts` (the prop signal wrapper in the element
constructor), `test/index.ts`, `CONTEXT.md` (Prop),
`docs/adr/ADR-007-client-templater.md`, `.size-limit.js` only if core
needs a bump (record it in ADR-007's note if so)

**Status:** done

- [x] After a signal is assigned to a host's prop accessor, calling the
      setup prop signal with a value throws, and the page's signal keeps
      its value
- [x] The thrown error message contains the tag name and the prop name
- [x] After a computed is bound, the write throws rather than being
      silently dropped
- [x] A prop with no bound signal can still be written by its own
      component's setup
- [x] Assigning a new signal to the accessor from outside still updates
      the component's view of the prop
- [x] `npm test` and `npm run size` pass
