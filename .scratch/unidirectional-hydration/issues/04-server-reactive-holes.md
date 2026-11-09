# 04: Server handling of reactive holes

**What to build:** A page written for the browser templater also renders
on the server. A signal or function in any hole is evaluated once. A
signal or function in child position has its output wrapped in a pair of
comment markers, `<!--[-->` and `<!--]-->`. Children passed to a component
are wrapped in the same markers before the render function receives them.
A function-valued `on<event>` prop is omitted from the output, on plain
elements and on hosts. A page with no reactive holes and no component
children produces the same bytes as before.

**Blocked by:** 03

**Touches:** `src/htm.ts` (`h`, `html`, child flattening, attribute
serialization), `test/ssr.ts`; existing expectations in `test/ssr.ts`,
`test/index.ts`, and `test/hydration.ts` that cover component children

**Status:** done

- [x] A signal in child position renders its current value between one
      `<!--[-->` and one `<!--]-->`
- [x] A function in child position is called once and its result is
      wrapped the same way, including when it returns markup, an array,
      `null`, or `false`
- [x] A signal or function as an attribute on a plain element renders its
      evaluated value; `false`, `null`, or `undefined` omits the attribute
- [x] A signal as a declared component prop reaches the render function
      as its plain value
- [x] Children passed to a component arrive wrapped in one marker pair;
      a component that drops its children emits no markers
- [x] A function-valued `on<event>` prop does not appear in the output
- [x] A page with no reactive holes and no component children is
      byte-identical to its output before this ticket
- [x] All Node suites and `npm test` pass
