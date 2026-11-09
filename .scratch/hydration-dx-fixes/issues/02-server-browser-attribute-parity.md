# 02: Server and browser emit the same attributes

**What to build:** For the same markup input, the server templater and
the browser templater's `String()` path produce the same HTML, apart
from region and children markers. On the server, interpolated attribute
values on plain elements and non-prop attributes passed to a component
are unwrapped from the templater's escaped wrapper and escaped once.
Non-prop attributes on a component follow the browser's rules: `true`
is an empty attribute, `false`, `null` and `undefined` are omitted,
anything else is stringified once. A link whose query holds `&` is
correct before JavaScript runs.

A single parity table of `(markup input, expected HTML)` cases is
shared by the SSR and browser suites. It covers `&`, quotes and `<` in
plain and host attributes, the four boolean and null values, and nested
markup. Static pages stay byte-identical, so the existing exact-string
SSR assertions pass unchanged.

Source: spec section "Server attribute serialization (finding 2)" and
the parity table in Testing Decisions.

**Blocked by:** None (can start immediately)

**Touches:** `src/htm.ts` (`h`: the plain-element attribute branch and
the component non-prop attribute branch), a new shared parity table
module under `test/` imported by both `test/ssr.ts` and
`test/index.ts`, `src/builders.ts` only if host-attribute serialization
of `true` needs adjusting

**Status:** done

- [x] Server output for an interpolated attribute holding `&`, `"` or
      `<` contains the value escaped exactly once
- [x] A non-prop attribute on a component with value `true` renders as
      an empty attribute, and `false`, `null` and `undefined` render no
      attribute
- [x] Every parity table case produces equal HTML from the server
      templater and the browser `String()` path, markers aside
- [x] Existing exact-string static page assertions in the SSR suite
      pass unchanged
- [x] `npm run test:ssr` and `npm test` pass
