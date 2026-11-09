# 03: `microtags/preact` renders components on the server

**What to build:** A new `microtags/preact` entry exporting
`toPreact(El, options?)`, which takes a microtags element class and
returns a Preact function component. This ticket ships its full public
type and the default (Node and SSR) build. The browser build follows in
ticket 04, so until then browsers also resolve the default build.

The returned component's props are typed from the class:

- the element's declared props;
- one optional callback prop per key of `options.events`, a map from
  callback prop name to DOM event name (e.g. `onChange` ->
  `number-input:change`);
- `class`, `id`, `aria-*` and `data-*`, passed through to the host;
- no children: passing them is a type error, and the adapter always
  throws, in both builds, with an error naming the tag.

On the server the adapter returns a host vnode whose attributes come
from `El.renderParts(props)` (ticket 01), with each empty-string value
(a true boolean) mapped to `true` so Preact emits a bare attribute,
plus the passthrough attributes. The inner HTML is the parts' `html`
through `dangerouslySetInnerHTML`. Callback props never reach the
output. The default build imports render support, as the Vite
transform does for kept render links (ADR-009). If the class has no
`renderParts`, because its render link was stripped or never written,
the adapter throws an error that names the tag and says to import the
variant that keeps its render link on the server.

`preact` becomes an optional peer dependency, like `typescript`. Pin
`preact` to exactly 10.29.7 in devDependencies and add
`preact-render-to-string`. Core and every other entry must never import
`preact`. Put the prop and type mapping that ticket 04 also needs in a
module both builds can share.

The new Node suite compares parsed output, not bytes, because Preact
orders and quotes attributes its own way: parse each host start tag
into a tag name and a decoded name -> value map with a small test
helper (no new parser dependency), and compare the inner HTML as a
string, since both sides take it from the same `html`.

**Blocked by:** 01

**Touches:** `src/preact.ts` (new, default build), a shared types and
props module for the adapter (new), `package.json` (`exports["./preact"]`
default condition with `types`, `import`, `require`; `src/preact.ts` in
`build-cjs` and `build-esm`; `peerDependencies` and
`peerDependenciesMeta` for `preact`; devDependencies `preact@10.29.7`
and `preact-render-to-string`; a `test:preact-ssr` script, added to
`gate` after `test:ssr`), `test/preact-ssr.ts` (new, run like
`test:ssr`), `test/types.ts`, `AGENTS.md` (a short section for the
entry).

**Status:** done

- [x] Preact SSR suite: `renderToString` of the adapter with given
      props yields the same tag, the same attribute map and the same
      inner HTML as `El.render` with those props, for a component with
      number, string, boolean, json and prop-only props.
- [x] Preact SSR suite: a true boolean prop is a bare attribute in the
      output, and a false or null prop is absent.
- [x] Preact SSR suite: `class`, `id`, `aria-*` and `data-*` props
      appear on the host, and mapped callback props do not.
- [x] Preact SSR suite: rendering the adapter for a class with no
      render link throws an error that contains the tag name.
- [x] Preact SSR suite: rendering the adapter with children throws an
      error that contains the tag name.
- [x] `test/types.ts`, importing from `'microtags/preact'`: declared
      props are accepted with their types; a mapped callback prop is
      accepted; an undeclared prop, a wrongly typed prop and children
      are each `@ts-expect-error`.
- [x] `npm run build` emits `dist/preact.js`, `dist/preact.cjs` and
      `dist/preact.d.ts`, and no other `dist` entry imports `preact`.
- [x] `npm run gate` runs the new suite and passes.
