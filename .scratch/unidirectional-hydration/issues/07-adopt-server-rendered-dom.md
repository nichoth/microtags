# 07: Adoption of server-rendered DOM

**What to build:** On first page load, `mount` **adopts** the server's
DOM instead of recreating it. When the container already has children,
`mount` walks the markup against the existing DOM in document order and
binds props, attributes, listeners, and reactive regions, creating no
nodes. Regions are located by the `<!--[-->` / `<!--]-->` markers the
server templater wrote (ticket 04). After adoption, state changes update
the DOM exactly as they do after a create-path mount.

Hosts are opaque during adoption: it never descends into a host's own
markup, and enters only the marked children range if the component
emitted one. A component that drops its children has no range and its
children are skipped. A stripped component is adopted without error,
because nothing needs to be created.

If the element at the expected position has the wrong tag name, adoption
warns in development and leaves the server DOM untouched for that
subtree.

**Blocked by:** 04, 06

**Touches:** the browser templater module (`mount` adoption path),
`test/index.ts` (fixtures built from server templater output or
equivalent static HTML with markers), `.size-limit.js` (raise the browser
templater entry to the measured result)

**Status:** done

- [x] Mounting over existing children creates no nodes: every element and
      host present before `mount` is the same node afterwards, and the
      container's node count is unchanged
- [x] After adoption, a signal prop updates the adopted host
- [x] After adoption, a bound attribute and an `on<event>` listener work
      on the adopted elements
- [x] After adoption, a conditional region adds and removes content and a
      keyed list reorders with host identity preserved
- [x] A host whose render link was stripped is adopted without throwing
- [x] Content inside a host's children range is bound; a host with no
      range has its markup children skipped
- [x] A tag name mismatch warns in development and leaves that subtree's
      DOM unchanged, while sibling subtrees are still bound
- [x] Dispose after adoption stops updates and leaves the DOM in place
- [x] `npm test` and `npm run size` pass
