# 03: Host tag serializer skips invalid attribute names

**What to build:** A component's host tag, built by the server render
path, omits any extra (non-prop) attribute whose name is not a valid
HTML attribute name, using the same grammar as ticket 02. Declared prop
names are not validated; they come from the builder chain, not from
data. This closes the last place where a hostile key from a spread
could reach a tag.

**Blocked by:** The hydration DX spec
(`.scratch/hydration-dx-fixes/spec.md`, "Server-render code out of
core's define path") moves the host tag serializer out of core. This
ticket lands after that move, in whichever module then holds the
serializer. That spec is not yet ticketed; when it is, record the
ticket number here.

**Touches:** Today `src/builders.ts` (`_renderHost`); after the DX
spec, the server render support module it creates. `test/ssr.ts`.

**Status:** done

- [x] SSR suite: a component's static `render` called with an extra
      attribute whose name is invalid emits a host tag without it,
      while a valid extra attribute in the same call is emitted.
- [x] SSR suite: declared props with the same values serialize exactly
      as before.
- [x] SSR suite: static pages stay byte-identical.
