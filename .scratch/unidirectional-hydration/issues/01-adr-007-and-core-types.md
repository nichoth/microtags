# 01: ADR-007 and core types

**What to build:** Record the client templater decision as ADR-007
(signal props, reactive regions, mount; relaxes ADR-004 for the templater
subpath only) and give app authors the two types they need to describe
state: `Signal` and `Serialized<T>`, both exported as types from the core
entry. `Serialized<T>` is a shallow unwrap: each property that is a signal
becomes its value type, other properties pass through. No runtime
serialization helper ships.

**Blocked by:** None (can start immediately)

**Touches:** `docs/adr/ADR-007-*.md` (new), `docs/adr/INDEX.md`,
`src/types.ts` (`Signal`, new `Serialized`), `src/index.ts` (type
exports), `test/types.ts`

**Status:** done

- [x] `import type { Signal, Serialized } from 'microtags'` typechecks
- [x] `Serialized<{ a:Signal<number>; b:Signal<string[]> }>` is
      `{ a:number; b:string[] }` in the type tests
- [x] A non-signal property passes through `Serialized<T>` unchanged
- [x] Nested signals are not unwrapped (the unwrap is shallow)
- [x] ADR-007 exists, covers context, decision, trade-offs, and
      consequences, and has a row in the index; no existing ADR is marked
      superseded
- [x] The core bundle gains no runtime code from this ticket
      (`npm run size` unchanged for `microtags`)
