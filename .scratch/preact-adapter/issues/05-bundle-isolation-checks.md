# 05: The built bundles prove the browser adapter carries no render code

**What to build:** A Node suite that reads the built `dist/` and proves
the adapter split holds, using the built-asset isolation approach of
`.scratch/millitags-lessons/issues/09-built-asset-isolation-check.md`:
a table pairs each forbidden fixed string with a control file that
proves the string survives bundling. For each marker the positive
control runs first and fails saying the marker is stale if the string
is missing from its control file. Only then is each checked file
asserted to lack it, one assertion per file. Markers are fixed
strings, never regexes.

`build-esm` uses `--splitting`, so an entry's code can live in shared
chunks. Each check reads the entry file and every chunk it imports,
following relative `import` specifiers transitively.

The checks:

- render support: a string that exists only in render support's
  serializer or escaper (not the `microtags.render*` symbol keys, which
  core also contains), controlled by `dist/render-support.js`, is
  absent from `dist/preact.browser.js` with its chunks and from
  `dist/preact.browser.min.js`;
- `preact-render-to-string`: its import specifier, controlled by
  `dist/preact.js` if the default build imports it (otherwise by a
  control the agent picks and names in the table), is absent from both
  browser adapter files;
- `preact`: an import of the bare specifier `preact`, controlled by
  `dist/preact.js`, is absent from every other `dist` entry and its
  chunks (`index`, `index.min`, `render`, `context`, `util`, `htm`,
  `htm.browser`, `render-support`, `build`, `esbuild`, `vite`).

**Blocked by:** 04

**Touches:** `test/bundles.ts` (new), `package.json` (a `test:bundles`
script, added to `gate` right after `size`), `AGENTS.md` (one line on
the suite and its marker table).

**Status:** done

- [x] Bundles suite: each marker is found in its named control file,
      and the test output names that file.
- [x] Bundles suite: the render support marker is absent from the
      browser adapter entry, each chunk it imports, and its min build,
      with one assertion per file.
- [x] Bundles suite: the `preact-render-to-string` marker is absent
      from both browser adapter files.
- [x] Bundles suite: no non-adapter `dist` entry or its chunks imports
      `preact`, with one assertion per file.
- [x] A marker missing from its control file fails with a message
      saying the marker is stale (verified with a temporary bogus
      marker during development, not committed).
- [x] `npm run gate` runs the suite and passes.
