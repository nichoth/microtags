# 06: Prepare the 0.1.0 release

**What to build:** Everything a maintainer needs before running
`npm version minor` (0.0.14 -> 0.1.0), which is a human step outside
this series: it runs lint, the tables of contents, `auto-changelog` and
`inject-size`, then tags, pushes and publishes. Do not run
`npm version` or `npm publish`, and do not edit `version` or
`CHANGELOG.md` by hand.

- README: a `### microtags/preact` section under "Subpath Exports"
  covering `toPreact(El, { events })`, a server render plus `hydrate`
  example, a client-only `render` example, the `browser` condition
  split, the optional `preact` peer dependency, that children are not
  supported, the props-before-definition edge, and a link to ADR-010.
  Mention `renderParts` there as the piece other host renderers can
  build on.
- README size table: a `microtags/preact` row with
  `<!-- size:preact -->`/`<!-- /size:preact -->` markers, and a
  matching `MARKERS` entry in `scripts/inject-size.ts` keyed on the
  browser adapter's size-limit name, so the `version` script fills it.
- Run `npm run toc` so the new section is in the table of contents.

**Blocked by:** 01, 02, 04, 05

**Touches:** `README.md`, `scripts/inject-size.ts`.

**Status:** done

- [x] `npm run build && npm run inject-size` fills the
      `microtags/preact` row without throwing.
- [x] `npm pack --dry-run` lists `dist/preact.js`, `dist/preact.cjs`,
      `dist/preact.d.ts`, `dist/preact.browser.js` and
      `dist/preact.browser.d.ts`.
- [x] The README table of contents includes the `microtags/preact`
      section, and the README contains no em dashes.
- [x] `npm run gate` passes.
