# Architecture Decision Records

Decisions that are hard to reverse, surprising without context, and the
result of a real trade-off. See `docs/agents/domain.md` for how agents
consume these and `CONTEXT.md` for the project glossary.

| # | Decision | Date |
|---|----------|------|
| [ADR-001](ADR-001-alien-signals-for-reactivity.md) | alien-signals as the reactivity primitive | 2026-06-28 |
| [ADR-002](ADR-002-no-shadow-dom.md) | No Shadow DOM | 2026-06-28 |
| [ADR-003](ADR-003-standard-schema-for-prop-validation.md) | Standard Schema for prop validation | 2026-06-28 |
| [ADR-004](ADR-004-client-bundle-size-outranks-ergonomics.md) | Client bundle size outranks API ergonomics | 2026-07-25 |
| [ADR-005](ADR-005-single-file-components-with-build-time-render-stripping.md) | Single-file components with build-time stripping of render code | 2026-09-23 |
| [ADR-006][adr-006] | Authored HTML scaffold served by Hono | 2026-09-25 |
| [ADR-007][adr-007] | Client templater: signal props, reactive regions, mount | 2026-10-04 |
| [ADR-008][adr-008] | Serialized server state and unidirectional hydration | 2026-10-04 |
| [ADR-009][adr-009] | Server render support loaded through the render link (amends ADR-005) | 2026-10-14 |
| [ADR-010][adr-010] | Preact owns the host, the element owns its children | 2026-11-08 |
| [ADR-011][adr-011] | Core renders an empty host with a kept render link (amends ADR-010) | 2026-11-10 |

[adr-006]: ADR-006-hono-html-scaffold.md
[adr-007]: ADR-007-client-templater.md
[adr-008]: ADR-008-serialized-server-state.md
[adr-009]: ADR-009-server-render-support-through-render-link.md
[adr-010]: ADR-010-preact-adapter-ownership-split.md
[adr-011]: ADR-011-core-renders-empty-host.md
