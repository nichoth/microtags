import type { Cleanup } from './types.js'

/**
 * Coerce a raw attribute string to a number.
 * Returns NaN if the value cannot be parsed.
 */
export function coerceNumber (raw:string | null):number {
    return raw === null ? NaN : Number(raw)
}

/**
 * Coerce a raw attribute string to a string.
 * Converts null to empty string.
 */
export function coerceString (raw:string | null):string {
    return raw ?? ''
}

/**
 * Coerce a raw attribute string to a boolean.
 * Absence (null) is false; presence of any value (including '') is true.
 */
export function coerceBoolean (raw:string | null):boolean {
    return raw !== null
}

/**
 * Coerce a raw attribute string to a parsed JSON value.
 * Returns undefined if the value is null or cannot be parsed.
 */
export function coerceJson<T = unknown> (raw:string | null):T | undefined {
    if (raw === null) return undefined
    try {
        return JSON.parse(raw) as T
    } catch {
        return undefined
    }
}

/**
 * Run every cleanup in the list, ensuring all run even if some throw.
 * After all have run, re-throws the first error encountered.
 */
export function runCleanups (fns:Cleanup[]):void {
    let firstError:unknown
    let caught = false
    for (const fn of fns) {
        try {
            fn()
        } catch (err) {
            if (!caught) {
                firstError = err
                caught = true
            }
        }
    }
    if (caught) throw firstError
}
