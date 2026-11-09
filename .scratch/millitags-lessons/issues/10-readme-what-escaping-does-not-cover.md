# 10: README: what escaping does not cover

**What to build:** An app author reading the templater docs finds a
subsection, in the voice of the existing README, that lists what
escaping does not protect against: `javascript:` and other URL schemes
are not made safe by attribute escaping, so validate the scheme; HTML
escaping inside `<script>` and `<style>` is wrong for those contexts;
`raw` skips escaping by construction and never takes user data;
attribute names that are not valid are skipped (the rule from tickets
02 and 03). It also states the void element rule from ticket 01. The
table of contents is regenerated. No em dashes, no arrow characters.

**Blocked by:** 01 (Void elements with children throw), 02 (Templaters
skip invalid attribute names). The docs describe those behaviours, so
they land after the code makes them true.

**Touches:** `README.md` (a new subsection under `microtags/htm`, near
the existing "Escaping" paragraph), then `npm run toc`.

**Status:** done

No tests, per the global rule against testing docs.

- [x] The new subsection covers URL schemes, `<script>` and `<style>`
      contexts, `raw`, invalid attribute names, and the void element
      rule.
- [x] `npm run toc` has been run and the table of contents lists the
      subsection.
- [x] The section contains no em dashes and no arrow characters.
