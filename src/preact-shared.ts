// Types and prop mapping shared by both builds of `microtags/preact`
// (the default server build and the browser build). Never imports
// render support. See ADR-010.
import type { FunctionComponent } from 'preact'
import type { RenderParts } from './builders.js'

/**
 * The part of a microtags element class the adapter reads. Any class
 * from `setup` fits; `renderParts` is absent at runtime when the class
 * has no render link.
 */
export interface PreactElementClass<P = any> {
    readonly TAG:string
    readonly props:readonly string[]
    readonly renderParts?:(
        props:P,
        options?:{ children?:string; attrs?:Record<string, string> }
    ) => RenderParts
}

/** Map from callback prop name to DOM event name. */
export type EventMap = Record<string, string>

export interface ToPreactOptions<E extends EventMap = EventMap> {
    /** e.g. `{ onChange: 'number-input:change' }` */
    events?:E
}

type AttrValue = string | number | boolean | null | undefined

/** Host attributes passed through to the host tag. */
export interface PassthroughProps {
    class?:string
    id?:string
    [aria:`aria-${string}`]:AttrValue
    [data:`data-${string}`]:AttrValue
}

/** The declared props of an element class, all optional. */
export type DeclaredProps<C> =
    C extends { renderParts?:(props:infer P, ...a:any[]) => any } ?
        Partial<P> :
        never

/**
 * Props of the Preact component `toPreact` returns: the declared
 * props, one callback per mapped event, passthrough host attributes,
 * and no children.
 */
export type PreactProps<C, E extends EventMap = Record<never, never>> =
    DeclaredProps<C> &
    { [K in keyof E]?:(ev:CustomEvent) => void } &
    PassthroughProps &
    { children?:never }

export type PreactComponent<C, E extends EventMap> =
    FunctionComponent<PreactProps<C, E>>

/** Props split by where they go on the host. */
export interface SplitProps {
    /** declared props, by name */
    own:Record<string, unknown>
    /** handlers, by DOM event name */
    on:Record<string, unknown>
    /** passthrough host attributes */
    rest:Record<string, unknown>
}

/**
 * Split adapter props into declared props, event handlers (keyed by DOM
 * event name) and passthrough attributes. Throws, naming the tag, when
 * children are passed.
 */
export function splitProps (
    El:PreactElementClass,
    events:EventMap,
    props:Record<string, unknown>
):SplitProps {
    if (props.children !== undefined) {
        throw new Error(`microtags/preact: <${El.TAG}> takes no children`)
    }
    const own:Record<string, unknown> = {}
    const on:Record<string, unknown> = {}
    const rest:Record<string, unknown> = {}
    for (const k in props) {
        if (k === 'children') continue
        if (El.props.includes(k)) own[k] = props[k]
        else if (Object.hasOwn(events, k)) on[events[k]] = props[k]
        else rest[k] = props[k]
    }
    return { own, on, rest }
}
