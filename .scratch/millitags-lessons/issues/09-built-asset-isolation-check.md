# 09: Built-asset isolation check with positive controls

**What to build:** The hydration suite proves that stripped markup and
server-only code are absent from the built client assets, and proves
that the check itself can fail. It reads every JavaScript asset under
the client build and the server build. A marker table pairs each
forbidden fixed string with the built server file that proves the
string survives bundling. Three markers: a string from the stripped
Counter's render output, chosen from its template and never from text
that also appears in kept components or library error messages; the
page marker comment from the scaffold module, proving server app code
is absent; and a string from the build entry's error text, proving the
TypeScript transform is absent. Markers are matched as fixed strings,
never regexes.

For each marker the positive control runs first: the string must appear
in its control file, or the test fails saying the marker is stale. Only
then is every client asset asserted to lack it. Each file is reported
separately so a zero count is never confused with a failed read. A
comment on the table says Badge and Notice are kept components whose
markup ships by design, so their strings are not markers, and that when
the Counter markup changes the marker changes in the same commit. One
inverse test builds a marker from a kept component's markup and asserts
it is found in a client asset, showing the scan reads the right files.

**Blocked by:** The hydration DX spec's example build fix
(`.scratch/hydration-dx-fixes/spec.md`, "Example build"), for the same
reason as ticket 08: the hydration suite does not build at HEAD. That
spec is not yet ticketed; when it is, record the ticket number here.

**Touches:** `test/hydration.ts` (new tests reading
`example-hydration/build/client/` and `example-hydration/build/server/`
with `fs`), the marker table beside them. Reference markup:
`example-hydration/components/counter.ts`, `server/scaffold.ts`
(`<!--microtags:main-->`), `src/build.ts` (its error text).

**Status:** done

- [x] Hydration suite: for each of the three markers, the marker is
      found in its named server build file (positive control), and the
      test reports the control file by name.
- [x] Hydration suite: for each marker, every JavaScript asset under
      the client build is read and asserted to lack it, with one
      assertion per file.
- [x] Hydration suite: a marker taken from a kept component's markup
      (Badge or Notice) is found in at least one client asset.
- [x] Hydration suite: a marker that appears in no server file fails
      the positive control with a message saying the marker is stale
      (verified by a temporary bogus marker during development, not
      committed).
