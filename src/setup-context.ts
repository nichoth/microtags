import { effect, peek } from './reactivity.js'
import { resolveContextSignal } from './context.js'
import type {
    SetupContext,
    Cleanup,
    Signal,
    PropsSignals,
    PropDef,
    ContextToken,
} from './types.js'

/**
 * Build the ctx object passed to a component's setup() callback.
 * The cleanups array is mutated in place so factory.ts can drain it
 * on disconnect without copying.
 */
export function makeSetupContext<
    Props extends Record<string, PropDef> = Record<string, PropDef>,
> (
    host:HTMLElement,
    props:PropsSignals<Props>,
    refs:Record<string, Element | Element[]>,
    contexts:Record<string, unknown>,
    cleanups:Cleanup[]
):SetupContext<Props, any, any> {
    return {
        host,
        props,
        refs,
        contexts,

        peek,

        on (target, type, handler, options?) {
            target.addEventListener(
                type as string,
                handler as EventListener,
                options
            )
            cleanups.push(() => {
                target.removeEventListener(
                    type as string,
                    handler as EventListener,
                    options
                )
            })
        },

        emit (
            nameOrEvent:Event | string,
            detail?:unknown,
            options?:Omit<CustomEventInit, 'detail'>
        ):boolean {
            const event = nameOrEvent instanceof Event ?
                nameOrEvent :
                new CustomEvent(nameOrEvent, {
                    bubbles: true,
                    ...options,
                    detail,
                })
            return host.dispatchEvent(event)
        },

        effect (fn) {
            const dispose = effect(fn)
            cleanups.push(dispose)
        },

        bind (source, control, opts) {
            const input = control instanceof HTMLInputElement ?
                control :
                undefined
            let prop = 'value'
            let autoEvent = 'change'
            if (input?.type === 'checkbox') {
                prop = 'checked'
            } else if (input?.type === 'number' ||
                input?.type === 'range') {
                prop = 'valueAsNumber'
                autoEvent = 'input'
            } else if (input || control instanceof HTMLTextAreaElement) {
                autoEvent = 'input'
            }

            const boundProp = opts?.prop ?? prop
            const event = opts ? opts.event : autoEvent
            const el = control as unknown as Record<string, unknown>

            if (event) {
                const handler = () => {
                    const writable = source as Signal<unknown>
                    writable(el[boundProp])
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
        },

        onCleanup (fn) {
            cleanups.push(fn)
        },

        consume<T> (token:ContextToken<T>):T | undefined {
            const sig = resolveContextSignal(host, token)
            return sig ? sig() : undefined
        },
    }
}
