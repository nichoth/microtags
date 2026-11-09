# 09: Typed helper to bind a signal to a host prop

**What to build:** Core exports a small helper that binds a signal to
a named prop of a host, typed so the signal's value type must match
the prop's type. It is equivalent to assigning the signal to the prop
accessor. The example's Counter uses it in place of the
`as unknown as` double cast. Attribute staleness after binding stays as
documented in the glossary.

Source: spec section "Typed binding (finding 14)".

**Blocked by:** 01 (the hydration and e2e suites that exercise Counter
must be green)

**Touches:** `src/builders.ts` or `src/factory.ts` (helper and its
type), `src/index.ts` (export), `test/types.ts` (signature and a
`@ts-expect-error` mismatch case), `test/index.ts`,
`example-hydration/components/counter.ts`, README API notes if the
public surface is listed there, `.size-limit.js` only if core needs a
bump

**Status:** done

- [x] Binding a signal with the helper makes the host's prop read the
      signal's value and track its changes
- [x] A type test shows a signal whose value type differs from the prop
      type does not compile, and a matching one does
- [x] Counter no longer contains an `as unknown as` cast and the
      nested Badge still follows the computed label
- [x] `npm run typecheck`, `npm test`, `npm run test:hydration` and
      `npm run size` pass
