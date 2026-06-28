import { signal } from './reactivity.js'
import { runCleanups } from './util.js'
import { makeSetupContext } from './setup-context.js'
import {
    resolveContextSignal,
    onContextAvailable,
} from './context.js'
import type {
    PropsSignals,
    Signal,
    SetupContext,
    Cleanup,
    Coercer,
    ContextToken,
    RefDef,
} from './types.js'

/**
 * Map of prop name to coercer function.
 * The factory accepts coercers exclusively; Standard Schema support is
 * layered on top in the withProps builder (US-005).
 */
export type FactoryProps = Record<string, Coercer<unknown>>

/**
 * The class to extend for custom elements. In the browser this is the
 * real HTMLElement; in Node (e.g. reading `.TAG` for SSR) it falls back
 * to an empty stub so the class can be defined without a DOM. The stub
 * is never instantiated or registered outside the browser.
 */
const HTMLElementBase = typeof HTMLElement !== 'undefined' ?
    HTMLElement :
    (class {} as unknown as typeof HTMLElement)

/** Configuration passed to factory(). */
export interface FactoryConfig<Props extends FactoryProps = FactoryProps> {
    /** Coercer for each observed attribute / prop. */
    props:Props
    /** Attribute names to pass to observedAttributes. */
    observedAttrNames:string[]
    /** Ref definitions keyed by name. */
    refs?:Record<string, RefDef>
    /** Context tokens keyed by name. */
    contexts?:Record<string, ContextToken<unknown>>
    /** Setup callback receiving the component context. */
    setup:(ctx:SetupContext<Props, any, any>) => void
}

/**
 * Collect resolved DOM refs from within a host element.
 * Throws if any single-ref element is missing.
 */
function collectRefs (
    host:HTMLElement,
    defs:Record<string, RefDef>
):Record<string, Element | Element[]> {
    const result:Record<string, Element | Element[]> = {}
    const missing:string[] = []
    for (const [key, def] of Object.entries(defs)) {
        const sel = def.selector ?? `[data-ref="${key}"]`
        if (def._microtag === 'ref:all') {
            result[key] = Array.from(host.querySelectorAll(sel))
        } else {
            const el = host.querySelector(sel)
            if (!el) {
                missing.push(key)
            } else {
                result[key] = el
            }
        }
    }
    if (missing.length > 0) {
        throw new Error(
            `${host.tagName}: missing refs: ${missing.join(', ')}`
        )
    }
    return result
}

/**
 * Create an HTMLElement subclass with the microtags lifecycle.
 * The returned class has no Shadow DOM, tracks its own prop signals,
 * and runs setup() on connect / cleanups on disconnect.
 */
export function factory<Props extends FactoryProps = FactoryProps> (
    config:FactoryConfig<Props>
):typeof HTMLElement {
    const {
        props: propDefs,
        observedAttrNames,
        setup,
        refs: refDefs = {},
        contexts: ctxDefs = {},
    } = config

    class MicrotagElement extends HTMLElementBase {
        static get observedAttributes () { return observedAttrNames }

        _props:Record<string, Signal<unknown>> = {}
        _cleanups:Cleanup[] = []

        constructor () {
            super()
            for (const [name, coercer] of Object.entries(propDefs)) {
                this._props[name] = signal(coercer(null))
            }
        }

        connectedCallback () {
            // Start a fresh cleanup scope for each connection cycle.
            this._cleanups = []

            // Hydrate prop signals from attributes; preserve any
            // programmatically-set value when the attribute is absent.
            for (const [name, coercer] of Object.entries(propDefs)) {
                const attrVal = this.getAttribute(name)
                if (attrVal !== null) {
                    (this._props[name] as Signal<unknown>)(coercer(attrVal))
                }
            }

            const cleanups = this._cleanups
            const props = this._props as PropsSignals<Props>

            // Reactive Proxy: reading a key inside a ctx.effect creates
            // a subscription to the provider's alien-signals signal.
            const contexts = new Proxy({} as Record<string, unknown>, {
                get: (_target, key) => {
                    if (typeof key !== 'string') return undefined
                    const token = ctxDefs[key]
                    if (!token) return undefined
                    const sig = resolveContextSignal(this, token)
                    return sig ? sig() : undefined
                },
                has: (_target, key) => {
                    if (typeof key !== 'string') return false
                    return key in ctxDefs
                },
            })

            let setupRan = false
            // Tracks pending-context cancel functions so they are
            // removed from the global registry when setup runs or
            // when the element disconnects.
            const cancelCallbacks:(() => void)[] = []

            const tryRunSetup = ():void => {
                if (setupRan) return
                for (const token of Object.values(ctxDefs)) {
                    if (!resolveContextSignal(this, token)) return
                }
                setupRan = true
                for (const cancel of cancelCallbacks) cancel()
                cancelCallbacks.length = 0

                const refs = collectRefs(this, refDefs)
                const ctx = makeSetupContext(
                    this, props, refs, contexts, cleanups
                )
                setup(ctx)
            }

            // Deferred variant: skip if element was disconnected before
            // the context became available.
            const tryRunSetupIfConnected = ():void => {
                if (!this.isConnected) return
                tryRunSetup()
            }

            // Register pending listeners for any missing contexts.
            for (const token of Object.values(ctxDefs)) {
                if (!resolveContextSignal(this, token)) {
                    const cancel = onContextAvailable(
                        token.id, tryRunSetupIfConnected
                    )
                    cancelCallbacks.push(cancel)
                    // Also cancel on disconnect so we don't leak.
                    cleanups.push(cancel)
                }
            }

            tryRunSetup()
        }

        attributeChangedCallback (
            name:string,
            _old:string | null,
            next:string | null
        ) {
            const coercer = propDefs[name]
            if (coercer !== undefined && this._props[name] !== undefined) {
                (this._props[name] as Signal<unknown>)(coercer(next))
            }
        }

        disconnectedCallback () {
            // Snapshot and clear BEFORE running so re-entrant calls are safe
            // and the array is always empty after this returns (or throws).
            const fns = this._cleanups
            this._cleanups = []
            runCleanups(fns)
        }
    }

    return MicrotagElement
}
