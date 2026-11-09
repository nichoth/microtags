import { STATE_ID } from '../state.js'

export { STATE_ID }

export const MARKER = '<!--microtags:main-->'
export const STATE_MARKER = '<!--microtags:state-->'

/**
 * Supplies the scaffold HTML. Development, production, and tests each
 * pass their own loader.
 */
export type ScaffoldLoader = () => string|Promise<string>

function count (haystack:string, needle:string):number {
    return haystack.split(needle).length - 1
}

/**
 * The state as an inert JSON script. `<` is escaped so the payload
 * cannot close the script element.
 */
export function stateScript (data:unknown):string {
    const json = JSON.stringify(data).replace(/</g, '\\u003c')
    return `<script type="application/json" id="${STATE_ID}">` +
        json + '</script>'
}

/**
 * Insert `body` at the page marker and `state` at the state marker.
 * Throws unless each marker appears exactly once.
 */
export function assemble (
    scaffold:string,
    body:string,
    state:string
):string {
    for (const marker of [MARKER, STATE_MARKER]) {
        const n = count(scaffold, marker)
        if (n !== 1) {
            throw new Error(
                `scaffold must contain exactly one ${marker}, found ${n}`
            )
        }
    }

    // callbacks, so `$&` and friends stay literal
    return scaffold
        .replace(STATE_MARKER, () => state)
        .replace(MARKER, () => body)
}

/**
 * Development loader: read the source scaffold on every request and run
 * it through Vite's HTML transform, so the Vite client and CSS links
 * are inserted. Reading and transforming are injected, so this module
 * stays free of Node and Vite imports.
 */
export function devLoader (
    read:() => string|Promise<string>,
    transform:(url:string, html:string) => Promise<string>,
    url:string
):ScaffoldLoader {
    return async () => transform(url, await read())
}
