// `microtags/preact`, default (Node and SSR) build. Renders the host
// tag with its attributes and inner HTML from the component's render
// parts, so `renderToString` matches the `render` static. Imports
// render support, as the build transform does for a kept render link
// (ADR-009). See ADR-010.
import { h, type VNode } from 'preact'
import './render-support.js'
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
        const { own, rest } = splitProps(El, events, props)
        if (!El.renderParts) {
            throw new Error(
                `microtags/preact: <${El.TAG}> has no render link. On ` +
                'the server, import the variant of this component that ' +
                'keeps its render link.'
            )
        }
        const extra:Record<string, string> = {}
        for (const k in rest) {
            if (rest[k] != null) extra[k] = String(rest[k])
        }
        const { tag, attrs, html } = El.renderParts(own, { attrs: extra })
        const vprops:Record<string, unknown> = {}
        for (const k in attrs) vprops[k] = attrs[k] === '' ? true : attrs[k]
        vprops.dangerouslySetInnerHTML = { __html: html }
        return h(tag, vprops)
    }
}
