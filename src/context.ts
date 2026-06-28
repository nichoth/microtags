import { signal } from './reactivity.js'
import type { ContextToken, Signal } from './types.js'

// Provider storage: element -> (contextId -> Signal)
const providerStorage = new WeakMap<Element, Map<symbol, Signal<unknown>>>()

// Pending consumers waiting for a context by id
const pendingCallbacks = new Map<symbol, Set<() => void>>()

/**
 * Create a new context token.
 * Each token uniquely identifies a type of shared context.
 */
export function createContext<T> ():ContextToken<T> {
    return { id: Symbol('microtag-context') }
}

/**
 * Provide a context value from an element to its descendants.
 * Returns a cleanup function that removes the provided value.
 */
export function provide<T> (
    element:Element,
    token:ContextToken<T>,
    value:T
):() => void {
    let map = providerStorage.get(element)
    if (!map) {
        map = new Map()
        providerStorage.set(element, map)
    }

    const existing = map.get(token.id) as Signal<T> | undefined
    if (existing) {
        existing(value)
    } else {
        const sig = signal(value) as unknown as Signal<T>
        map.set(token.id, sig as Signal<unknown>)
    }

    notifyPending(token.id)

    return () => {
        const m = providerStorage.get(element)
        if (m) {
            m.delete(token.id)
            if (m.size === 0) providerStorage.delete(element)
        }
    }
}

/**
 * Walk up the DOM from element to find the nearest provider signal.
 * Returns the signal (not the value) so callers can subscribe to changes.
 */
export function resolveContextSignal<T> (
    element:Element,
    token:ContextToken<T>
):Signal<T> | undefined {
    let current:Element | null = element.parentElement
    while (current) {
        const map = providerStorage.get(current)
        if (map && map.has(token.id)) {
            return map.get(token.id) as Signal<T>
        }
        current = current.parentElement
    }
    return undefined
}

/**
 * Register a callback to run when the given context becomes available.
 * Returns a cleanup function to unregister.
 */
export function onContextAvailable (
    id:symbol,
    callback:() => void
):() => void {
    let set = pendingCallbacks.get(id)
    if (!set) {
        set = new Set()
        pendingCallbacks.set(id, set)
    }
    set.add(callback)
    return () => { pendingCallbacks.get(id)?.delete(callback) }
}

function notifyPending (id:symbol):void {
    const set = pendingCallbacks.get(id)
    if (set) {
        for (const cb of set) cb()
    }
}
