# PRD: microtags

## Introduction

`microtags` is a port of [nanotags](https://nanotags.psdcoder.dev/) — a
tiny, typed, Custom Elements wrapper that gives you a reactive component
model with automatic cleanup, no Shadow DOM, and a hydration-first
design. The one substantive change from nanotags is the reactivity
engine: microtags uses [alien-signals](https://github.com/stackblitz/alien-signals)
instead of nanostores.

nanotags exposes reactive props as nanostores atoms
(`$count.get()` / `.set()` / `.subscribe()`). microtags exposes the
underlying alien-signals values directly: a prop is a callable signal
(`count()` reads, `count(v)` writes). The builder/`define` surface
(`.withProps()`, `.withRefs()`, `.withContexts()`, `.setup()`) stays
identical to nanotags; only the read/write shape of reactive values
changes.

The work is a 1:1 port of all nanotags modules and all three export
entrypoints (`.`, `./render`, `./context`), built on this repository's
existing substrate-system tooling (esbuild dual ESM/CJS output,
`exports` map, lightningcss, tapout/tapzero browser tests).

## Goals

- Reproduce the full nanotags public API surface, swapping nanostores
  for alien-signals as the reactivity engine.
- Expose reactive values to user code as native alien-signals (callable
  read/write), not as wrapped nanostores-shaped atoms.
- Ship all three entrypoints with parity: `microtags`, `microtags/render`,
  `microtags/context`.
- Preserve nanotags' automatic-cleanup guarantee: every listener,
  effect, binding, and custom teardown registered during `setup()` is
  removed on `disconnectedCallback`.
- Keep Standard Schema prop validation (Zod / Valibot / ArkType via
  `@standard-schema/spec`) alongside the built-in coercers.
- Provide full TypeScript inference across the builder chain (props,
  refs, and contexts inferred into `setup()`).
- Port nanotags' behavioral tests to this repo's tapout/tapzero runner,
  without brittle text/DOM-string assertions.

## Reference: nanotags source modules to port

The nanotags source (`packages/nanotags/src`) is 8 implementation
modules, each with a colocated `.test.ts`:

| Module | Responsibility |
|---|---|
| `define.ts` | Fluent entry: `define(tag).withProps().withRefs().withContexts().setup()` |
| `builders.ts` | The `withProps` / `withRefs` / `withContexts` builder callbacks (coercers, schema, ref selectors) |
| `factory.ts` | Custom-element class factory + lifecycle (connected / disconnected / attributeChanged) + cleanup scope |
| `setup-context.ts` | The `ctx` object handed to `setup()` (`host`, `props`, `refs`, `on`, `effect`, `bind`, `onCleanup`, `consume`) |
| `context.ts` | Cross-component context (the `./context` entrypoint) |
| `render.ts` | Templating helpers (the `./render` entrypoint) |
| `utils.ts` | Shared helpers |
| `types.ts` | Shared types |
| `index.ts` | Main entrypoint barrel |

## User Stories

### US-001: Project setup and package identity
**Description:** As a developer, I need the repo configured as the
`microtags` package with the right dependencies and export map so the
ported modules resolve correctly.

**Acceptance Criteria:**
- [ ] `package.json` name set to the microtags package name; template
      placeholders (`{{package-name}}`, `{{repo-name}}`,
      `{{component-name}}`) replaced or removed
- [ ] `alien-signals` added as a dependency
- [ ] `@standard-schema/spec` added as a dependency
- [ ] `exports` map exposes `.`, `./render`, and `./context` subpaths in
      both ESM and CJS, matching the existing dual-format build
- [ ] `npm run build` produces `dist/index`, `dist/render`,
      `dist/context` in both formats with type declarations
- [ ] Typecheck and lint pass

### US-002: Port shared types and utils
**Description:** As a developer, I need the foundational `types.ts` and
`utils.ts` ported so the rest of the modules have their primitives.

**Acceptance Criteria:**
- [ ] `src/types.ts` ports nanotags' shared types, adjusted so reactive
      values are typed as alien-signals signals rather than nanostores
      atoms
- [ ] `src/utils.ts` ports nanotags' shared helpers
- [ ] No reference to `nanostores` remains in either file
- [ ] Typecheck and lint pass

### US-003: Reactivity adapter over alien-signals
**Description:** As a developer, I need a small internal reactivity layer
that the factory and setup-context use, so every nanostores call site in
nanotags maps cleanly onto alien-signals.

**Acceptance Criteria:**
- [ ] Internal helpers created for: creating a signal, reading a signal,
      writing a signal, running an auto-tracked effect, and disposing a
      group of effects (via `effectScope`)
- [ ] A prop value handed to user code is the native alien-signals
      callable signal (`count()` to read, `count(v)` to write)
- [ ] An `untracked(fn)` helper reads inside `fn` without creating a
      subscription, implemented via `setCurrentSub(undefined)` with
      restore in a `finally` (per the alien-signals pattern)
- [ ] A `peek(signal)` convenience returns the signal's current value
      without subscribing (`peek(s)` === `untracked(() => s())`)
- [ ] `peek` and `untracked` are exported from the main entrypoint
- [ ] Effects created during a component's `setup()` are grouped in an
      `effectScope` so they can be disposed together on disconnect
- [ ] Typecheck and lint pass

### US-004: Port the custom-element factory and lifecycle
**Description:** As a developer, I need `factory.ts` ported so `define()`
produces a real custom element with the nanotags lifecycle and cleanup
scope.

**Acceptance Criteria:**
- [ ] Factory produces an `HTMLElement` subclass with no Shadow DOM
- [ ] `connectedCallback` hydrates props from attributes and runs
      `setup()`
- [ ] `attributeChangedCallback` updates the corresponding prop signal
- [ ] `disconnectedCallback` runs all registered cleanups
- [ ] Reconnecting re-runs `setup()` with a fresh cleanup scope while
      preserving programmatically-set prop values
- [ ] If a cleanup throws, the remaining cleanups still run and the first
      error re-throws afterward (nanotags behavior)
- [ ] Typecheck and lint pass

### US-005: Port the builder callbacks (props, refs, contexts)
**Description:** As a developer, I need `builders.ts` ported so
`.withProps()`, `.withRefs()`, and `.withContexts()` declare typed,
inferred props/refs/contexts.

**Acceptance Criteria:**
- [ ] `withProps((p) => ...)` supports the built-in coercers
      (`number`, `string`, `boolean`, `json`)
- [ ] `withProps` accepts any Standard Schema validator (e.g. Zod,
      Valibot, ArkType) for a prop
- [ ] Attribute-backed, JSON, and property-only prop variants supported
- [ ] `withRefs((r) => ...)` resolves single (`r.one`) and multiple
      (`r.all`) refs via `[data-ref="name"]` selectors
- [ ] `withContexts((c) => ...)` declares context dependencies
- [ ] Props, refs, and contexts are type-inferred through the chain into
      `setup()`
- [ ] Typecheck and lint pass

### US-006: Port the `define()` fluent entry
**Description:** As a developer, I need `define.ts` ported so the
chainable builder ties the pieces together and registers the element.

**Acceptance Criteria:**
- [ ] `define(tagName)` returns a builder with `.withProps`,
      `.withRefs`, `.withContexts`, and `.setup`
- [ ] Calling `.setup(callback)` registers the custom element
- [ ] The chain compiles with full inference (props/refs/contexts visible
      and correctly typed inside `setup()`)
- [ ] Exported from `src/index.ts`
- [ ] Typecheck and lint pass

### US-007: Port the setup context (`ctx`)
**Description:** As a developer, I need `setup-context.ts` ported so the
`ctx` object passed to `setup()` exposes the nanotags API backed by
alien-signals.

**Acceptance Criteria:**
- [ ] `ctx.host` is the element; `ctx.props` are callable signals;
      `ctx.refs` are resolved refs; `ctx.contexts` are resolved contexts
- [ ] `ctx.peek(signal)` reads a signal's value without subscribing,
      even when called inside a `ctx.effect`
- [ ] `ctx.on(target, type, handler)` adds a listener, auto-removed on
      disconnect
- [ ] `ctx.effect(...)` runs an alien-signals effect that auto-tracks the
      signals it reads and is auto-disposed on disconnect
- [ ] `ctx.bind(target, property, signal)` two-way binds a DOM property
      to a signal, auto-cleaned on disconnect
- [ ] `ctx.onCleanup(fn)` registers custom teardown run on disconnect
- [ ] `ctx.consume(token)` reads an optional context
- [ ] Typecheck and lint pass

### US-008: Port cross-component context (`microtags/context`)
**Description:** As a developer, I need `context.ts` ported so components
can provide and consume shared context, deferring setup until required
contexts resolve.

**Acceptance Criteria:**
- [ ] `microtags/context` entrypoint exports the context creation /
      provide / consume API matching nanotags
- [ ] A component declaring required contexts via `.withContexts()` does
      not run `setup()` until those contexts resolve
- [ ] Context values are backed by alien-signals so consumers react to
      changes
- [ ] Typecheck and lint pass

### US-009: Port the render helpers (`microtags/render`)
**Description:** As a developer, I need `render.ts` ported so the
templating helpers are available from the `./render` subpath.

**Acceptance Criteria:**
- [ ] `microtags/render` entrypoint exports the render/templating helpers
      with the same signatures as nanotags
- [ ] Helpers are tree-shakeable (isolated subpath, `sideEffects: false`)
- [ ] Typecheck and lint pass

### US-010: Port the test suite to tapout/tapzero
**Description:** As a developer, I need the nanotags behavioral tests
ported to this repo's browser runner so API parity is verified.

**Acceptance Criteria:**
- [ ] Tests cover: `define`, reactive props (read/write/react), attribute
      hydration, refs (`one`/`all`), contexts (provide/consume/deferred
      setup), untracked reads (a `peek`/`untracked` read inside an effect
      does NOT re-run the effect when that signal later changes), and
      cleanup (listeners, effects, bindings, onCleanup, throwing-cleanup
      behavior)
- [ ] Tests run via `npm test` (esbuild → tapout) and pass
- [ ] No assertions on specific rendered text or HTML strings
- [ ] Typecheck and lint pass

### US-011: Update README, example, and docs
**Description:** As a user, I want documentation that reflects the
microtags API and the alien-signals reactivity model.

**Acceptance Criteria:**
- [ ] README documents `define`, props, refs, contexts, the `ctx` API
      (including `peek` / `untracked` for non-subscribing reads), and both
      sub-entrypoints, using the callable-signal read/write form
- [ ] README notes the one divergence from nanotags: native alien-signals
      (callable) replace nanostores atoms; `$`-prefixed atom names become
      plain callable signal names
- [ ] The `example/` app uses the ported API and runs
- [ ] Typecheck and lint pass
- [ ] Verify the example in the browser using the dev-browser skill

## Functional Requirements

- FR-1: microtags MUST expose `define(tagName)` returning a fluent
  builder with `.withProps`, `.withRefs`, `.withContexts`, and `.setup`.
- FR-2: `.setup(callback)` MUST register the custom element and invoke
  `callback(ctx)` on `connectedCallback`.
- FR-3: Reactive props MUST be exposed to user code as native
  alien-signals (callable: `signal()` reads, `signal(value)` writes).
- FR-3a: microtags MUST provide an untracked read path — `untracked(fn)`
  and a `peek(signal)` convenience — that returns current values without
  creating a subscription, even inside an active effect. These MUST be
  exported from the main entrypoint and available as `ctx.peek`.
- FR-4: `.withProps` MUST support built-in coercers (`number`, `string`,
  `boolean`, `json`) and any Standard Schema validator.
- FR-5: `.withRefs` MUST resolve single and multiple `[data-ref]` DOM
  references (`r.one`, `r.all`).
- FR-6: `.withContexts` MUST declare context dependencies, and `setup()`
  MUST be deferred until all declared contexts resolve.
- FR-7: The `ctx` object MUST expose `host`, `props`, `refs`, `contexts`,
  `peek`, `on`, `effect`, `bind`, `onCleanup`, and `consume`.
- FR-8: All of `ctx.on`, `ctx.effect`, `ctx.bind`, and `ctx.onCleanup`
  MUST be automatically torn down on `disconnectedCallback`.
- FR-9: When cleanup throws, remaining cleanups MUST still run and the
  first error MUST re-throw after they complete.
- FR-10: `attributeChangedCallback` MUST update the matching prop signal;
  programmatically-set props MUST survive reconnection.
- FR-11: The package MUST ship three entrypoints — `microtags`,
  `microtags/render`, `microtags/context` — in ESM and CJS with type
  declarations, and `sideEffects: false`.
- FR-12: The package MUST depend on `alien-signals` and
  `@standard-schema/spec`, and MUST NOT depend on `nanostores`.
- FR-13: The component model MUST NOT use Shadow DOM (hydration-first,
  light-DOM, matching nanotags).
- FR-14: Builder chain types MUST infer props, refs, and contexts into
  `setup()`.

## Non-Goals (Out of Scope)

- Maintaining a nanostores-compatible atom interface
  (`.get()`/`.set()`/`.subscribe()`) on reactive values. microtags
  exposes native alien-signals instead — this is the one intentional API
  divergence.
- Shadow DOM, scoped styles, or a virtual DOM. microtags stays a thin
  Custom Elements wrapper.
- Reworking the repository's build tooling beyond the `exports` map and
  dependency changes (keep esbuild dual ESM/CJS, lightningcss, tapout).
- Publishing to npm as part of this work.
- Adding features not present in nanotags.
- A compatibility shim or codemod for migrating existing nanotags code.

## Design Considerations

- nanotags has no Shadow DOM and is hydration-first: server-rendered
  markup enhanced on the client. Keep that model.
- Reactive read/write shape is the only user-visible change. Where
  nanotags docs show `ctx.props.$count.get()`, microtags shows
  `ctx.props.count()`.
- The existing scaffold (`src/index.ts` `Example` component) is a
  placeholder and will be replaced by the ported modules.

## Technical Considerations

- **nanostores → alien-signals mapping:**
  `atom(v)` → `signal(v)`; `store.get()` → `sig()`;
  `store.set(v)` → `sig(v)`; `store.subscribe(cb)` → `effect(() => cb(sig()))`;
  `computed` → `computed`; per-component subscription grouping →
  `effectScope` (dispose on disconnect). nanostores `.get()` is an
  untracked read; alien-signals reads auto-subscribe inside an effect, so
  the equivalent is `peek`/`untracked` (see below).
- **Untracked reads (`peek` / `untracked`):** implement with
  alien-signals' `setCurrentSub`:
  `const prev = setCurrentSub(undefined); try { return fn() } finally { setCurrentSub(prev) }`.
  `peek(signal)` is the one-signal convenience over `untracked`. This is
  how callers read a signal "when they don't need updates" without
  leaking a subscription into the surrounding effect.
- **`ctx.effect` shape:** alien-signals effects auto-track the signals
  read inside them, so the natural form is `ctx.effect(() => { ... })`
  rather than nanotags' `ctx.effect(store, cb)`. Confirm the final
  signature during US-007 (see Open Questions).
- **Cleanup scope:** wrap each `setup()` run in an `effectScope` plus a
  list of listener/binding/onCleanup teardowns; `disconnectedCallback`
  disposes the scope and runs teardowns with the throwing-cleanup
  semantics from FR-9.
- **`@substrate-system/web-component`:** nanotags implements its own
  element factory, so this dependency may be droppable. Decide in US-004.
- **Standard Schema:** `@standard-schema/spec` is the only runtime dep
  nanotags carries besides nanostores; port the validation path intact.
- Tests need a DOM (custom elements), so the browser runner
  (tapout/tapzero) is the right home — no jsdom shimming required.

## Success Metrics

- Code written against the nanotags builder/`define`/refs/contexts API
  compiles against microtags with only reactive read/write call sites
  changed (callable signals).
- All ported tests pass via `npm test`.
- Bundle stays small (nanotags is < 3.2 KB across entrypoints); track but
  do not hard-gate microtags size.
- Three working entrypoints importable in both ESM and CJS consumers.

## Open Questions

- Final signature for `ctx.effect`: auto-tracked `(fn)` form only, or
  also support an explicit `(signal, cb)` overload for closer nanotags
  parity?
- Should `ctx.bind` accept a callable signal directly, and should it
  remain two-way (DOM → signal and signal → DOM) as in nanotags?
- Keep or drop `@substrate-system/web-component` once the factory is
  self-contained?
- Does any nanotags type rely on nanostores-specific generics that need a
  hand-written alien-signals equivalent in `types.ts`?
