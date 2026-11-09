// `microtags/preact`, browser build. Renders the host tag only: the
// declared props go to the host's prop accessors, mapped events become
// `on<event-name>` listeners, and a per-instance fixed
// `dangerouslySetInnerHTML` keeps Preact out of the host's children.
// Never imports render support. See ADR-010.
import { h, type VNode } from 'preact'
import { useRef } from 'preact/hooks'
import {
    splitProps,
    type EventMap,
    type PreactComponent,
    type PreactElementClass,
    type ToPreactOptions,
} from './preact-shared.js'

export type {
    DeclaredProps,
    EventMap,
    PassthroughProps,
    PreactComponent,
    PreactElementClass,
    PreactProps,
    ToPreactOptions,
} from './preact-shared.js'

interface State {
    /** the host has been committed once (hydrated or mounted) */
    live:boolean
    /** the inner HTML, fixed once the host is live */
    html:string
    inner?:{ readonly __html:string }
}

/**
 * Wrap a microtags element class as a Preact component. Preact owns the
 * host and its attributes; the element owns the host's children.
 */
export function toPreact<
    C extends PreactElementClass,
    E extends EventMap = Record<never, never>,
> (El:C, options?:ToPreactOptions<E>):PreactComponent<C, E> {
    const events:EventMap = options?.events ?? {}
    return (props:Record<string, unknown>):VNode<any> => {
        const { own, on, rest } = splitProps(El, events, props)
        const s = useRef<State>({ live: false, html: '' }).current!
        const vprops:Record<string, unknown> = { ...rest, ...own }
        for (const k in on) vprops['on' + k] = on[k]
        // Preact reads `__html` only outside hydration: on a client-only
        // mount (before the ref below runs), when the element's render
        // fills the host. Once live the value never changes, so Preact
        // never writes `innerHTML` over the element's children again.
        vprops.dangerouslySetInnerHTML = s.inner ??= {
            get __html () {
                if (!s.live && El.renderParts) {
                    const extra:Record<string, string> = {}
                    for (const k in rest) {
                        if (rest[k] != null) extra[k] = String(rest[k])
                    }
                    s.html = El.renderParts(own, { attrs: extra }).html
                }
                return s.html
            },
        }
        // A fresh ref per render runs on every commit. Preact skips
        // non-function props while hydrating and later skips a value
        // equal to the hydrated one, so assign any the host lacks.
        vprops.ref = (el:Record<string, unknown>|null) => {
            if (!el) return
            s.live = true
            for (const k in own) {
                const v = own[k]
                if (typeof v !== 'function' && el[k] !== v) el[k] = v
            }
        }
        return h(El.TAG, vprops)
    }
}
