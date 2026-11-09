# ADR-001: alien-signals as the reactivity primitive

**Date:** 2026-06-28

## Context

microtags ports the builder API of nanotags, which models reactive props
with nanostores atoms. A reactive primitive is needed for props, effects,
two-way bindings, and provided context. The requirements are: very small
(see ADR-004), effects that track their own dependencies so component
authors never write a dependency list, and no coupling to a UI framework.

## Decision

Use alien-signals. A signal is a callable: `count()` reads and subscribes,
`count(value)` writes. Every prop declared with `withProps` is a signal at
`ctx.props.name`. `ctx.effect` wraps the alien-signals effect, auto-tracks
the signals read inside it, and is disposed when the host disconnects.
Provided context values are stored as signals so consumers re-run when a
provider updates. The core entry re-exports only `peek` and `untracked`;
component authors import `signal` from alien-signals directly. The
`microtags/min` build inlines alien-signals.

## Consequences

Easier: `ctx.effect(() => ...)` needs no explicit dependencies, and the
same primitive serves props, bindings, and context. No `$` naming
convention is needed.

Harder: any read inside an effect subscribes, so an intentionally
untracked read must go through `peek` or `untracked`. alien-signals is
part of the visible public surface: the callable `Signal<T>` shape appears
in the types, and users depend on the package directly. Swapping the
primitive would be a breaking change to every component.
