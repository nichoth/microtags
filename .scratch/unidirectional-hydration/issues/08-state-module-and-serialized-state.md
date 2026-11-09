# 08: ADR-008, state module, and serialized state in every response

**What to build:** Every response from the hydration example carries the
state the server built for that request, as inert JSON. Record the design
as ADR-008 (serialized server state and unidirectional hydration).

The state module is shared by both sides. `AppState` is signals of JSON
values only: `route`, `count`, `noticeOpen`, and the list's labels.
`State` takes an optional partial of `Serialized<AppState>` and fills
defaults for missing keys. Signals are written only inside static
functions on `State` (increase, decrease, open and dismiss the notice,
add and remove a label). A function that produces the serialized form
lives beside it. The module imports types from the package name
(`microtags`), not from library source paths.

Each route handler builds state for the request. `route` is the request
path with the mount prefix removed; unknown paths keep the requested path
so the not-found page serializes state too. On the index route, a `count`
query parameter is accepted only when it is a finite integer; otherwise
the default of 5 applies.

State is written as a JSON script element with a fixed id, with `<`
escaped so the payload cannot close the script. The scaffold gains a
second marker for it, placed before the module script. `assemble` takes
both the page and the state payload and throws unless each marker appears
exactly once.

Pages are still rendered by the existing route bodies in this ticket, and
the client does not read the state yet.

**Blocked by:** 01

**Touches:** `docs/adr/ADR-008-*.md` (new), `docs/adr/INDEX.md`,
`example-hydration/state.ts` (`AppState`, `State`, static mutators,
serialize function), `example-hydration/server/app.ts` (`createApp`,
handlers, `notFound`), `example-hydration/server/scaffold.ts` (`assemble`,
new state marker constant), `example-hydration/index.html`,
`example-hydration/server/ssr.ts`, `test/hydration.ts`,
`test/hydration-dev.ts` and `test/hydration-listen.ts` only where the
scaffold shape changed

**Status:** done

- [x] Every route's response, including the 404, contains exactly one
      state script with the fixed id, placed before the module script
- [x] The script's content parses as JSON and round-trips: `State(parsed)`
      serializes back to an equal object
- [x] `route` in the payload is the request path without the prefix; an
      unknown path keeps the requested path
- [x] `?count=12` on the index route yields `count` 12 in the payload
- [x] A non-integer, non-finite, or non-numeric `count` falls back to 5
- [x] A request path containing `</script>` cannot close the state
      script: the document still has one state script that parses
- [x] `assemble` throws when the state marker is missing or duplicated,
      and when the page marker is missing or duplicated
- [x] `State()` with no input and `State` with a partial input both fill
      defaults for missing keys
- [x] Each static mutator changes only its own signal
- [x] ADR-008 exists with a row in the index
- [x] `npm run test:hydration`, `npm run test:hydration-dev`, and
      `npm run typecheck:hydration` pass
