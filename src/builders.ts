import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
    PropDef,
    PropertyOnlyProp,
    SetupContext,
    Coercer,
    RefDef,
    SingleRefDef,
    MultipleRefDef,
    RefsMap,
    ContextToken,
    ContextsMap,
} from './types.js'
import {
    coerceNumber,
    coerceString,
    coerceBoolean,
    coerceJson,
} from './util.js'
import { factory } from './factory.js'

function isPropOnly (def:unknown):def is PropertyOnlyProp<unknown> {
    return (
        typeof def === 'object' &&
        def !== null &&
        '_microtag' in def &&
        (def as { _microtag: unknown })._microtag === 'prop'
    )
}

function isStandardSchema (def:unknown):def is StandardSchemaV1 {
    return (
        typeof def === 'object' &&
        def !== null &&
        '~standard' in def
    )
}

function normalizePropDef (
    name:string,
    def:PropDef<unknown>
):Coercer<unknown> {
    if (isPropOnly(def)) {
        return (_raw:string | null) => def.initial
    }
    if (isStandardSchema(def)) {
        const schema = def as StandardSchemaV1
        return (raw:string | null):unknown => {
            const result = schema['~standard'].validate(raw)
            if (result instanceof Promise) {
                throw new TypeError(
                    `withProps: async schemas are not supported (prop "${name}")`
                )
            }
            if (result.issues) return undefined
            return result.value
        }
    }
    return def as Coercer<unknown>
}

/** The DSL object passed to the withProps callback. */
export type PropDSL = {
    number():Coercer<number>
    string():Coercer<string>
    boolean():Coercer<boolean>
    json<T>():Coercer<T | undefined>
    schema<T>(validator:StandardSchemaV1<unknown, T>):StandardSchemaV1<unknown, T>
    prop<T>(initial:T):PropertyOnlyProp<T>
}

export const propDSL:PropDSL = {
    number: () => coerceNumber,
    string: () => coerceString,
    boolean: () => coerceBoolean,
    json: <T>() => coerceJson as Coercer<T | undefined>,
    schema: <T>(v:StandardSchemaV1<unknown, T>) => v,
    prop: <T>(initial:T):PropertyOnlyProp<T> => (
        { _microtag: 'prop', initial }
    ),
}

/**
 * DSL object passed to the withRefs callback.
 * Call `r.one()` for a single element or `r.all()` for multiple. Pass a
 * CSS selector to query by it, or omit it to match `[data-ref="<key>"]`.
 *
 * Element typing:
 * - `r.one()` defaults to `HTMLElement`.
 * - `r.one<T>()` sets the type and keeps the `[data-ref]` selector.
 * - `r.one('button')` infers the type from the tag AND queries by that
 *   tag, exactly like `document.querySelector('button')`.
 */
export type RefsDSL = {
    one<K extends keyof HTMLElementTagNameMap>(
        selector:K
    ):SingleRefDef<HTMLElementTagNameMap[K]>
    one<T extends HTMLElement = HTMLElement>(selector?:string):SingleRefDef<T>

    all<K extends keyof HTMLElementTagNameMap>(
        selector:K
    ):MultipleRefDef<HTMLElementTagNameMap[K]>
    all<T extends HTMLElement = HTMLElement>(selector?:string):MultipleRefDef<T>
}

export const refsDSL:RefsDSL = {
    one: ((selector?:string):SingleRefDef => (
        { _microtag: 'ref:one', selector }
    )) as RefsDSL['one'],
    all: ((selector?:string):MultipleRefDef => (
        { _microtag: 'ref:all', selector }
    )) as RefsDSL['all'],
}

/**
 * DSL object passed to the withContexts callback.
 * Currently a no-op placeholder; the user references imported
 * context tokens directly in the returned record.
 */
export type ContextDSL = Record<never, never>
const contextDSL:ContextDSL = {}

/**
 * Maps each declared ref key to its own name as a string literal. Exposed
 * as the static `refs` on a registered element so server-rendered templates
 * can fill in `data-ref` values without hardcoding the names, e.g.
 * `data-ref="${myCounter.refs.dec}"`.
 */
export type RefNames<RefDefs extends Record<string, RefDef>> = {
    readonly [K in keyof RefDefs]:K & string
}

/**
 * A registered custom element class that also exposes, as static members,
 * the tag name it was registered under (`TAG`) and the names of its
 * declared refs (`refs`).
 */
export type MicrotagElementClass<
    RefDefs extends Record<string, RefDef> = Record<never, never>
> = typeof HTMLElement & {
    /** The custom element tag name, e.g. 'my-counter'. */
    readonly TAG:string
    /**
     * The declared ref names, each mapping to its own `data-ref` string.
     * Lets server-rendered markup reference refs by key instead of a magic
     * string: `myCounter.refs.dec`.
     */
    readonly refs:RefNames<RefDefs>
}

/**
 * Fluent builder that accumulates props/refs/contexts config
 * before registering a custom element via `.setup()`.
 */
export class ComponentBuilder<
    Props extends Record<string, PropDef> = Record<never, never>,
    RefDefs extends Record<string, RefDef> = Record<never, never>,
    CtxDefs extends Record<string, ContextToken<unknown>> =
        Record<never, never>,
> {
    private readonly _coercers:Record<string, Coercer<unknown>>
    private readonly _observed:string[]
    private readonly _refDefs:Record<string, RefDef>
    private readonly _ctxDefs:Record<string, ContextToken<unknown>>

    constructor (
        readonly tagName:string,
        coercers:Record<string, Coercer<unknown>> = {},
        observed:string[] = [],
        refDefs:Record<string, RefDef> = {},
        ctxDefs:Record<string, ContextToken<unknown>> = {}
    ) {
        this._coercers = coercers
        this._observed = observed
        this._refDefs = refDefs
        this._ctxDefs = ctxDefs
    }

    /**
     * The custom element tag name, e.g. 'my-counter'. Available at every
     * point in the fluent chain since each builder method returns a new
     * builder carrying the same tag name.
     */
    get TAG ():string {
        return this.tagName
    }

    withProps<P extends Record<string, PropDef>> (
        fn:(p:PropDSL) => P
    ):ComponentBuilder<P, RefDefs, CtxDefs> {
        const defs = fn(propDSL)
        const coercers:Record<string, Coercer<unknown>> = {}
        const observed:string[] = []

        for (const [name, def] of Object.entries(defs)) {
            coercers[name] = normalizePropDef(name, def as PropDef<unknown>)
            if (!isPropOnly(def)) {
                observed.push(name)
            }
        }

        return new ComponentBuilder<P, RefDefs, CtxDefs>(
            this.tagName, coercers, observed, this._refDefs, this._ctxDefs
        )
    }

    withRefs<R extends Record<string, RefDef>> (
        fn:(r:RefsDSL) => R
    ):ComponentBuilder<Props, R, CtxDefs> {
        const defs = fn(refsDSL)
        return new ComponentBuilder<Props, R, CtxDefs>(
            this.tagName,
            this._coercers,
            this._observed,
            defs,
            this._ctxDefs
        )
    }

    withContexts<C extends Record<string, ContextToken<unknown>>> (
        fn:(c:ContextDSL) => C
    ):ComponentBuilder<Props, RefDefs, C> {
        const defs = fn(contextDSL)
        return new ComponentBuilder<Props, RefDefs, C>(
            this.tagName,
            this._coercers,
            this._observed,
            this._refDefs,
            defs
        )
    }

    setup (
        fn:(ctx:SetupContext<
            Props,
            RefsMap<RefDefs>,
            ContextsMap<CtxDefs>
        >) => void
    ):MicrotagElementClass<RefDefs> {
        const El = factory({
            props: this._coercers,
            observedAttrNames: this._observed,
            refs: this._refDefs,
            contexts: this._ctxDefs,
            setup: fn as any,
        })
        Object.defineProperty(El, 'TAG', {
            value: this.tagName,
            enumerable: true,
        })

        // Expose each ref key as its own `data-ref` name so server-rendered
        // markup can reference refs by key instead of a hardcoded string.
        const refNames:Record<string, string> = {}
        for (const key of Object.keys(this._refDefs)) {
            refNames[key] = key
        }
        Object.defineProperty(El, 'refs', {
            value: Object.freeze(refNames),
            enumerable: true,
        })

        if (typeof customElements !== 'undefined') {
            customElements.define(this.tagName, El)
        }
        return El as MicrotagElementClass<RefDefs>
    }
}

/** Create a new component builder for the given tag name. */
export function define (tagName:string):ComponentBuilder {
    return new ComponentBuilder(tagName)
}
