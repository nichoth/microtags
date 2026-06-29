import {
    signal,
    effect,
    effectScope,
    setActiveSub,
} from 'alien-signals'
import type { Signal } from './types.js'

// Re-export alien-signals primitives under stable names for internal use.
export { signal, effect, effectScope }

/**
 * Run fn without tracking any signals it reads.
 * Suspends the current subscriber via setActiveSub(undefined),
 * restoring it in a finally block so nested effects are unaffected.
 */
export function untracked<T> (fn:() => T):T {
    const prev = setActiveSub(undefined)
    try {
        return fn()
    } finally {
        setActiveSub(prev)
    }
}

/**
 * Read a signal's current value without subscribing.
 * Equivalent to untracked(() => sig()).
 */
export function peek<T> (sig:Signal<T>):T {
    return untracked(() => sig())
}
