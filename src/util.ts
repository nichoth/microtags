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
 * Run every function in the list, ensuring all run even if some throw.
 * After all have run, re-throws the first error encountered.
 */
export function runAll (fns:(() => void)[]):void {
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

export type Attrs = Record<string, undefined|null|string|number|boolean|(string|number)[]>

/**
 * Transform an object into an HTML attributes string. The object should be
 * like `{ attributeName: value }`.
 *
 * @param {Attrs} attrs An object for the attributes.
 * @returns {string} A string suitable for use as HTML attributes.
 */
export function toAttributes (attrs:Attrs):string {
    return Object.keys(attrs).reduce((acc, k) => {
        const value = attrs[k]
        if (!value) return acc

        if (typeof value === 'boolean') {
            if (value) return (acc + ` ${k}`).trim()
            return acc
        }

        if (Array.isArray(value)) {
            return (acc + ` ${k}="${value.join(' ')}"`)
        }

        return (acc + ` ${k}="${value}"`).trim()
    }, '')
}
