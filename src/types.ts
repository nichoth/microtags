import type { StandardSchemaV1 } from '@standard-schema/spec'

/**
 * A callable alien-signals signal.
 * Call with no args to read (and subscribe in an effect).
 * Call with a value to write.
 */
export type Signal<T> = {
    ():T
    (value:T):void
}

/** Converts a raw attribute string (or null) to T. */
export type Coercer<T> = (raw:string | null) => T

/**
 * A property-only prop: not backed by an attribute.
 * The signal is initialised to `initial` and never updated
 * from an attribute string.
 */
export interface PropertyOnlyProp<T> {
    readonly _microtag:'prop'
    readonly initial:T
}

/**
 * A prop definition accepted by withProps.
 * Either a bare coercer function, a Standard Schema validator,
 * or a property-only marker.
 */
export type PropDef<T = unknown> =
    | Coercer<T>
    | StandardSchemaV1<unknown, T>
    | PropertyOnlyProp<T>

/** Infer T from a PropDef. */
export type PropType<D> =
    D extends Coercer<infer T>
        ? T
        : D extends StandardSchemaV1<infer _I, infer O>
            ? O
            : D extends PropertyOnlyProp<infer T>
                ? T
                : never

/** Map a record of PropDefs to a record of callable Signals. */
export type PropsSignals<Defs extends Record<string, PropDef>> = {
    [K in keyof Defs]: Signal<PropType<Defs[K]>>
}

/** Opaque token identifying a context. */
export interface ContextToken<T> {
    readonly _type?:T
    readonly id:symbol
}

/** Infer the value type from a ContextToken. */
export type ContextValue<Tok> =
    Tok extends ContextToken<infer T> ? T : never

/** Map a record of ContextTokens to their resolved values. */
export type ContextsMap<Tokens extends Record<string, ContextToken<unknown>>> = {
    [K in keyof Tokens]: ContextValue<Tokens[K]> | undefined
}

/**
 * The shape every ref marker shares. Used as the constraint for `withRefs`
 * and `RefsMap`. It deliberately omits the phantom `_type`, so it provides
 * no inference site that could pin the element type during inference — this
 * is what lets an un-annotated `r.one()` fall back to the `HTMLElement`
 * default instead of collapsing to `Element`.
 */
export interface RefDef {
    readonly _microtag:'ref:one' | 'ref:all'
    readonly selector?:string
}

/**
 * Marker: a single element. Resolved by the optional CSS `selector`,
 * or by `[data-ref="<key>"]` when no selector is given. The phantom `T`
 * carries the resolved element type to `RefsMap`.
 */
export interface SingleRefDef<T extends HTMLElement = HTMLElement>
    extends RefDef {
    readonly _microtag:'ref:one'
    /** Phantom only: carries the element type for RefsMap. Never set. */
    readonly _type?:T
}

/**
 * Marker: all matching elements. Resolved by the optional CSS `selector`,
 * or by `[data-ref="<key>"]` when no selector is given. The phantom `T`
 * carries the resolved element type to `RefsMap`.
 */
export interface MultipleRefDef<T extends HTMLElement = HTMLElement>
    extends RefDef {
    readonly _microtag:'ref:all'
    /** Phantom only: carries the element type for RefsMap. Never set. */
    readonly _type?:T
}

/** Resolve a record of RefDefs to their DOM types. */
export type RefsMap<Defs extends Record<string, RefDef>> = {
    [K in keyof Defs]:
        Defs[K] extends MultipleRefDef<infer T> ? T[] :
        Defs[K] extends SingleRefDef<infer T> ? T :
        never
}

/** Options for ctx.bind. Omit `event` for a one-way binding. */
export type BindOptions = { prop?:string; event?:string }

/**
 * The setup context (ctx) passed to every component's setup() callback.
 * This is the shape declaration so factory.ts and define.ts can typecheck
 * against it before setup-context.ts is implemented.
 */
export interface SetupContext<
    Props extends Record<string, PropDef> = Record<string, PropDef>,
    Refs extends Record<string, Element | Element[] | null> = Record<
        string,
        Element | Element[] | null
    >,
    Contexts extends Record<string, unknown> = Record<string, unknown>,
> {
    /** The host custom element. */
    host:HTMLElement

    /** Callable signals for each declared prop. */
    props:PropsSignals<Props>

    /** Resolved DOM refs keyed by name. */
    refs:Refs

    /** Resolved context values keyed by name. */
    contexts:Contexts

    /**
     * Read a signal's current value without creating a subscription,
     * even when called inside a ctx.effect.
     */
    peek<T>(sig:Signal<T>):T

    /** Add a DOM event listener that is auto-removed on disconnect. */
    on<K extends keyof HTMLElementEventMap>(
        target:EventTarget,
        type:K,
        handler:(event:HTMLElementEventMap[K]) => void,
        options?:boolean | AddEventListenerOptions
    ):void
    on(
        target:EventTarget,
        type:string,
        handler:EventListener,
        options?:boolean | AddEventListenerOptions
    ):void

    /**
     * Dispatch an event from the host. Pass a pre-built `Event` to
     * dispatch it as-is, or a name (plus optional `detail` and
     * `CustomEventInit` options) to construct and dispatch a
     * bubbling `CustomEvent`. Returns `dispatchEvent`'s result:
     * `false` when a cancelable event had `preventDefault()` called.
     */
    emit(event:Event):boolean
    emit<D>(
        name:string,
        detail?:D,
        options?:Omit<CustomEventInit<D>, 'detail'>
    ):boolean

    /**
     * Run an alien-signals effect that auto-tracks the signals it reads.
     * The effect is auto-disposed on disconnect.
     */
    effect(fn:() => void|(() => void)):void

    /**
     * Bind a signal to a DOM element. The signal is the source of
     * truth: the element property is set from the signal on bind and
     * on every change, auto-cleaned on disconnect.
     *
     * With no options the control type is auto-detected and the
     * binding is two-way (user input flows back into the signal).
     * With an options object, `prop` defaults to the auto-detected
     * property and `event` is the write-back event; omit `event` for
     * a one-way binding. A read-only getter (`() => T`) is also
     * accepted as the source for a one-way derived value — pass it
     * with options and omit `event`.
     */
    bind<T>(
        signal:Signal<T>,
        element:Element,
        options?:BindOptions
    ):void

    /** Register custom teardown to run on disconnect. */
    onCleanup(fn:() => void):void

    /** Read an optional context value. */
    consume<T>(token:ContextToken<T>):T | undefined
}
