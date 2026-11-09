import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Markup } from './htm.js'
import type { Markup as BrowserMarkup } from './htm.browser.js'
import type {
    PropDef,
    PropType,
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
// The serializer kind is decided here, by coercer identity, so the
// server render support module never compares coercers from another
// copy of the package.
export type PropKind =
    'prop-only' | 'schema' | 'boolean' | 'json' | 'coercer'

export interface PropMeta {
    kind:PropKind
    coercer:Coercer<unknown>
}

/**
 * What a `render` static hands the server render support module: tag,
 * prop metadata, ref names and the render function. This shape is a
 * contract between package copies; changing it needs a new symbol key.
 */
export interface RenderRecord {
    t:string
    m:Record<string, PropMeta>
    r:Record<string, string>
    f:RenderFn<any, any>
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
 * `data-ref="${MyCounter.refs.dec}"`.
 */
export type RefNames<RefDefs extends Record<string, RefDef>> = {
    readonly [K in keyof RefDefs]:K & string
}

/** Plain values for props (not signals) in the render context. */
export type RenderProps<Defs extends Record<string, PropDef>> = {
    [K in keyof Defs]:PropType<Defs[K]>
}

export interface RenderContext<
    Props extends Record<string, PropDef> = Record<never, never>,
    RefDefs extends Record<string, RefDef> = Record<never, never>,
> {
    props:RenderProps<Props>
    refs:RefNames<RefDefs>
    TAG:string
    children:string
    attrs:Record<string, string>
}

export type RenderFn<
    Props extends Record<string, PropDef> = Record<never, never>,
    RefDefs extends Record<string, RefDef> = Record<never, never>,
> = (
    ctx:RenderContext<Props, RefDefs>
) => string | Markup | BrowserMarkup

export interface RenderOptions {
    client?:boolean
}

export type StaticRenderFn<
    Props extends Record<string, PropDef>,
> = (
    props:RenderProps<Props>,
    options?:{ children?:string; attrs?:Record<string, string> }
) => string

/**
 * A component's server render as parts: the host tag name, its
 * serialized host attributes (declared props first, then extra attrs,
 * unescaped; a true boolean is the empty string) and the inner HTML.
 */
export interface RenderParts {
    tag:string
    attrs:Record<string, string>
    html:string
}

export type StaticRenderPartsFn<
    Props extends Record<string, PropDef>,
> = (
    props:RenderProps<Props>,
    options?:{ children?:string; attrs?:Record<string, string> }
) => RenderParts

/**
 * A host element: an `HTMLElement` with a property accessor for each
 * declared prop, typed as the prop's value. A signal bound with
 * `bindProp` makes the prop read through to it.
 */
export type MicrotagHost<
    Props extends Record<string, PropDef> = Record<never, never>,
> = HTMLElement & RenderProps<Props>

/**
 * A registered custom element class that also exposes, as static members,
 * the tag name it was registered under (`TAG`) and the names of its
 * declared refs (`refs`).
 */
export type MicrotagElementClass<
    Props extends Record<string, PropDef> = Record<never, never>,
    RefDefs extends Record<string, RefDef> = Record<never, never>,
> = {
    new ():MicrotagHost<Props>
    readonly prototype:MicrotagHost<Props>
    /** The custom element tag name, e.g. 'my-counter'. */
    readonly TAG:string
    /**
     * The declared ref names, each mapping to its own `data-ref` string.
     * Lets server-rendered markup reference refs by key instead of a magic
     * string: `MyCounter.refs.dec`.
     */
    readonly refs:RefNames<RefDefs>
    readonly render:StaticRenderFn<Props>
    readonly renderParts:StaticRenderPartsFn<Props>
    readonly props:readonly (keyof Props & string)[]
}

/**
 * Fluent builder that accumulates props/refs/contexts config
 * before registering a custom element via `.setup()`.
 */
export class ComponentBuilder<
    Props extends Record<string, PropDef> = Record<never, never>,
    RefDefs extends Record<string, RefDef> = Record<never, never>,
    CtxDefs extends Record<string, ContextToken<unknown>> = Record<never, never>,
> {
    private readonly _coercers:Record<string, Coercer<unknown>>
    private readonly _observed:string[]
    private readonly _propNames:string[]
    private readonly _propMetas:Record<string, PropMeta>
    private readonly _refDefs:Record<string, RefDef>
    private readonly _ctxDefs:Record<string, ContextToken<unknown>>
    private readonly _renderFn?:RenderFn<Props, RefDefs>

    constructor (
        readonly tagName:string,
        coercers:Record<string, Coercer<unknown>> = {},
        observed:string[] = [],
        refDefs:Record<string, RefDef> = {},
        ctxDefs:Record<string, ContextToken<unknown>> = {},
        propNames:string[] = [],
        propMetas:Record<string, PropMeta> = {},
        renderFn?:RenderFn<any, any>,
    ) {
        this._coercers = coercers
        this._observed = observed
        this._propNames = propNames
        this._propMetas = propMetas
        this._refDefs = refDefs
        this._ctxDefs = ctxDefs
        this._renderFn = renderFn as
            RenderFn<Props, RefDefs> | undefined
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
        const propNames:string[] = []
        const propMetas:Record<string, PropMeta> = {}

        for (const [name, def] of Object.entries(defs)) {
            const coercer = normalizePropDef(
                name,
                def as PropDef<unknown>
            )
            coercers[name] = coercer
            propNames.push(name)

            const kind = isPropOnly(def) ?
                'prop-only' as const :
                isStandardSchema(def) ?
                    'schema' as const :
                    coercer === coerceBoolean ?
                        'boolean' as const :
                        coercer === coerceJson ?
                            'json' as const :
                            'coercer' as const

            propMetas[name] = { kind, coercer }

            if (!isPropOnly(def)) {
                observed.push(name)
            }
        }

        return new ComponentBuilder<P, RefDefs, CtxDefs>(
            this.tagName,
            coercers,
            observed,
            this._refDefs,
            this._ctxDefs,
            propNames,
            propMetas,
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
            this._ctxDefs,
            this._propNames,
            this._propMetas,
            this._renderFn,
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
            defs,
            this._propNames,
            this._propMetas,
            this._renderFn,
        )
    }

    render (
        fn:RenderFn<Props, RefDefs>,
        _options?:RenderOptions
    ):ComponentBuilder<Props, RefDefs, CtxDefs> {
        return new ComponentBuilder<Props, RefDefs, CtxDefs>(
            this.tagName,
            this._coercers,
            this._observed,
            this._refDefs,
            this._ctxDefs,
            this._propNames,
            this._propMetas,
            fn,
        )
    }

    setup (
        fn:(ctx:SetupContext<
            Props,
            RefsMap<RefDefs>,
            ContextsMap<CtxDefs>
        >) => void
    ):MicrotagElementClass<Props, RefDefs> {
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

        const refNames:Record<string, string> = {}
        for (const key of Object.keys(this._refDefs)) {
            refNames[key] = key
        }
        Object.defineProperty(El, 'refs', {
            value: Object.freeze(refNames),
            enumerable: true,
        })

        Object.defineProperty(El, 'props', {
            value: Object.freeze([...this._propNames]),
            enumerable: true,
        })

        if (this._renderFn) {
            const rec:RenderRecord = {
                t: this.tagName,
                m: this._propMetas,
                r: Object.freeze({ ...refNames }),
                f: this._renderFn,
            }
            // One helper per registry key, so both statics share the
            // lookup and the error.
            const link = (k:string) => (p:unknown, o:unknown) => {
                const f = (globalThis as any)[Symbol.for('microtags.' + k)]
                if (!f) {
                    throw new Error(
                        `microtags: ${k} needs "microtags/render-support"`
                    )
                }
                return f(rec, p, o)
            }
            Object.defineProperties(El, {
                render: { value: link('render'), enumerable: true },
                renderParts: {
                    value: link('renderParts'),
                    enumerable: true,
                },
            })
        }

        if (typeof customElements !== 'undefined') {
            customElements.define(this.tagName, El)
        }
        return El as unknown as MicrotagElementClass<Props, RefDefs>
    }
}

/** Create a new component builder for the given tag name. */
export function define (tagName:string):ComponentBuilder {
    return new ComponentBuilder(tagName)
}

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
