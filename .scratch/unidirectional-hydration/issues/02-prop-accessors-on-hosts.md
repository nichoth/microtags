# 02: Prop accessors on hosts

**What to build:** A component author can drive a host's props from
JavaScript. Every host gets a property accessor for each declared prop.
Reading returns the current value. Assigning a plain value writes the
prop. Assigning a signal makes the prop read through to that signal, so
the setup context's prop signal tracks it. A property assigned before the
host is upgraded is picked up at upgrade. Accessor types derive from the
prop definitions. This is the only core runtime change in the spec.

After a signal is assigned, the host's HTML attribute is no longer
updated; tests must not treat the attribute as the current value.

**Blocked by:** None (can start immediately)

**Touches:** `src/factory.ts` (the `_props` signals, upgrade path,
`attributeChangedCallback`), `src/builders.ts` and `src/types.ts`
(`MicrotagElementClass` instance type; update `setup()` call sites),
`test/index.ts`, `test/types.ts`, `.size-limit.js` (raise `microtags` to
the measured result)

**Status:** done

- [x] Reading `host.<prop>` returns the current prop value
- [x] Assigning a plain value updates the prop signal seen by setup, and
      an effect in setup re-runs
- [x] Assigning a signal makes the prop follow that signal: writing the
      signal later updates what setup reads
- [x] A property assigned on an element before its component is
      registered is picked up when the host upgrades (value and signal
      cases)
- [x] Attribute changes still update the prop when no signal is assigned
- [x] In the type tests, `host.<prop>` has the type of the prop
      definition and rejects a wrong-typed assignment
- [x] `npm test`, `npm run test:ssr`, and `npm run size` pass
