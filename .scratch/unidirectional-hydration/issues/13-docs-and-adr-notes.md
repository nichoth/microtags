# 13: Docs and ADR notes

**What to build:** Bring the written record in line with what shipped.
No tests cover docs.

The example README describes the state module, the pages directory, the
client entry, and the scaffold's two markers, and still lists every
hydration npm script and directory. The agent instructions for the
example are updated to match (pages directory, state transport, badge
kept, counter props and events, the attribute caveat after a signal is
assigned to a prop accessor, the browser templater build and its
size-limit entry).

The glossary gains **markup**, **mount**, **reactive region**, and
**adopt**, and the entries for **templater**, **trusted string**,
**hydration**, and **prop** are revised. **Template** stays reserved for
the native `<template>` element.

ADR-005 gets a note that the templater's return type changed and that a
component created in the browser must be kept. ADR-006 gets a note about
the second scaffold marker and the root wrapper. Neither is superseded.

Use `--` rather than em dashes and `->` rather than arrow characters.

**Blocked by:** 11, 12

**Touches:** `example-hydration/README.md` (then `npm run
toc:hydration`), `AGENTS.md` (templater, example hydration, and builder
sections), `CONTEXT.md`,
`docs/adr/ADR-005-single-file-components-with-build-time-render-stripping.md`,
`docs/adr/ADR-006-hono-html-scaffold.md`, top-level `README.md` only
where it documents `html` returning a string

**Status:** done

- [x] The glossary defines markup, mount, reactive region, and adopt, and
      the four revised entries match the shipped behaviour
- [x] The example README names every hydration npm script and every
      directory that exists, and its table of contents is regenerated
- [x] AGENTS.md no longer describes `html` as returning a plain string,
      `server/routes.ts`, or a single scaffold marker
- [x] ADR-005 and ADR-006 each carry the note described above and are not
      marked superseded
- [x] No doc states that a host's attribute reflects the current value of
      a signal-bound prop
- [x] `npm run lint` passes with `example-hydration/build/` deleted
