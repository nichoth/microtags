# Two-way `ctx.bind` with nanotags parity

Date: 2026-06-27

## Problem

The current `ctx.bind` has the signature
`bind(target, property, signal)` and, despite a doc comment claiming
"two-way", only does a one-way write of the signal into a DOM property.
Two problems follow:

1. The element-first signature reads backwards from the English meaning
   of "bind a signal to an element", and `target` is typed
   `Record<string, unknown>`, so every DOM element (e.g.
   `HTMLButtonElement`) trips `ts(2345)` at the call site.
2. It is not actually two-way, so form controls cannot push user input
   back into a signal without hand-written `ctx.on` + `signal(...)` glue.

## Goal

Reshape `ctx.bind` to mirror nanotags' `bind`:

- Signature `bind(signal, element, options?)` — source first.
- True two-way binding, with full auto-detection of native control type
  when no options are passed.
- One-way bindings remain easy (omit the write-back `event`), and a
  read-only getter is accepted for one-way derived values.

This is a behavior change to a public API. All four existing call sites
migrate in the same change.

## Design

### Types (`src/types.ts`)

Two overloads plus an options type. The writable-signal overload covers
two-way and one-way; the getter overload is one-way only, enforced by
forbidding `event`.

```ts
export type BindOptions = { prop?:string; event?:string }
export type OneWayBindOptions = { prop?:string; event?:undefined }
```

In `SetupContext`, replace the single `bind` member with:

```ts
/**
 * Bind a signal to a DOM element. The signal is the source of truth:
 * the element property is set from the signal on bind and on every
 * change, auto-cleaned on disconnect.
 *
 * With no options the control type is auto-detected and the binding is
 * two-way (user input flows back into the signal). With an options
 * object, `prop` defaults to the auto-detected property and `event`
 * is the write-back event; omit `event` for a one-way binding.
 */
bind<T>(
    signal:Signal<T>,
    element:Element,
    options?:BindOptions
):void
/**
 * One-way bind a read-only getter to an element property. The getter
 * may read other signals; the binding re-runs when they change.
 */
bind<T>(
    source:() => T,
    element:Element,
    options:OneWayBindOptions
):void
```

The getter overload requires an `options` argument (with `event`
omitted). This prevents the silent footgun of `bind(getter, el)` with no
options resolving to a two-way binding whose write-back would call the
getter with an argument and discard it.

### Behavior (`src/setup-context.ts`)

Ported from nanotags' `bind`, adapted to microtags' alien-signals
primitives (`effect(() => ...)` auto-tracks; `signal(value)` writes;
cleanups are pushed onto the closure array).

Auto-detect table (only fills in a missing `prop`/`event`):

| element                          | prop            | event    |
| -------------------------------- | --------------- | -------- |
| `<input type=checkbox>`          | `checked`       | `change` |
| `<input type=number\|range>`     | `valueAsNumber` | `input`  |
| other `<input>` / `<textarea>`   | `value`         | `input`  |
| `<select>`, custom `.value`, etc | `value`         | `change` |

Directionality rule (identical to nanotags):

- No options object -> two-way: forward (signal -> element) via an
  effect, plus write-back (element -> signal) on the auto-detected event.
- Options present -> `prop` defaults to the auto-detected property;
  `event` is whatever the caller passes. Omitting `event` means one-way.

```ts
bind (source, control, opts) {
    const input = control instanceof HTMLInputElement ?
        control :
        undefined
    let prop = 'value'
    let autoEvent = 'change'
    if (input?.type === 'checkbox') {
        prop = 'checked'
    } else if (input?.type === 'number' || input?.type === 'range') {
        prop = 'valueAsNumber'
        autoEvent = 'input'
    } else if (input || control instanceof HTMLTextAreaElement) {
        autoEvent = 'input'
    }

    const boundProp = opts?.prop ?? prop
    const event = opts ? opts.event : autoEvent
    const el = control as Record<string, unknown>

    if (event) {
        const handler = () => {
            (source as Signal<unknown>)(el[boundProp])
        }
        control.addEventListener(event, handler)
        cleanups.push(() => {
            control.removeEventListener(event, handler)
        })
    }

    const dispose = effect(() => {
        el[boundProp] = source()
    })
    cleanups.push(dispose)
}
```

No feedback loop: the forward effect assigns the property
programmatically, which does not fire `input`/`change`; write-back runs
only on genuine user events.

### Migration

| Site | Before | After |
| --- | --- | --- |
| `example/count-button.ts:24` | `ctx.bind(button, 'label', ctx.props.label)` | `ctx.bind(ctx.props.label, button, { prop: 'textContent' })` |
| `test/index.ts:583` | `ctx.bind(input as ..., 'value', ctx.props.label)` | `ctx.bind(ctx.props.label, input, { prop: 'value' })` |
| `test/index.ts:1166` | same shape | `ctx.bind(ctx.props.label, input, { prop: 'value' })` |
| `README.md:258-259` | `ctx.bind(el, 'textContent', () => String(...))` | `ctx.bind(() => String(...), el, { prop: 'textContent' })` |

The `example/count-button.ts` change also fixes a latent bug: binding to
the non-existent `label` property of a `<button>` wrote an inert expando
and rendered nothing; `textContent` is what the comment intends. The
`Record<string, unknown>` casts in the tests are removed.

## Testing

Keep the existing one-way + disconnect-cleanup tests, updated to the new
argument order. Add:

- Two-way: dispatching an `input` event on a bound text input updates the
  signal (write-back path).
- Auto-detect: a checkbox bound with no options uses `checked`/`change`
  (toggling it updates the signal; updating the signal toggles it).

Tests assert behavior (property values, signal values), not HTML text, in
line with the project's testing rules.

## Out of scope

- No new `computed`/derived-signal primitive; one-way derived values use
  the getter overload or `ctx.effect`.
- No change to other `SetupContext` members.
