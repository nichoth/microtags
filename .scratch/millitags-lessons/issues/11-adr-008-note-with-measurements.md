# 11: ADR-008 note with measurements

**What to build:** A future maintainer reading ADR-008 finds a dated
note, appended after its Consequences and not changing its decision,
that records the measurements millitags took on 2026-08-18 with its
toolchain, attributed as such: fifty rendered items as HTML alone, as a
JSON payload alone, and as both, brotli compressed, where the compressor
recovered about eight percent of the duplicated data; and the brotli
import cost of library deserializers (devalue, turbo-stream, seroval,
flatted) against `JSON.parse`, each larger than a hand-written reviver
and the first three more than half of a core bundle. The note states the
conclusion the numbers support: the payload stays narrow and
`JSON.parse` stays the reviver, which is what ADR-008 already decided.
The exact figures come from the millitags repo at `../millitags/`
(its ADR on serialized state and the scripts beside it); copy them with
their units rather than paraphrasing.

**Blocked by:** None (can start immediately)

**Touches:** `docs/adr/ADR-008-serialized-server-state.md` (a new
dated "Note" section at the end). `docs/adr/INDEX.md` is unchanged,
since no ADR is added or superseded.

**Status:** done

No tests, per the global rule against testing docs.

- [x] ADR-008 ends with a dated note attributing the measurements to
      millitags and its toolchain, giving the three brotli sizes and
      the recovered fraction, and the deserializer import costs
      against `JSON.parse`.
- [x] The note states the conclusion and leaves the Decision,
      Trade-offs and Consequences sections unchanged.
- [x] The note contains no em dashes and no arrow characters.
