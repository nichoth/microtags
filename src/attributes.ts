export type Attrs = Record<string, undefined|null|string|number|boolean|(string|number)[]>

/**
 * Transform an object into an HTML attributes string. The object should be
 * like `{ attributeName: value }`.
 *
 * @param attrs An object for the attributes.
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
