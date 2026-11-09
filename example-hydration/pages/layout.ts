import { html, type Markup } from 'microtags/htm'
import type { AppState } from '../state.js'

export const PREFIX = '/example-hydration'

const LINKS:[string, string][] = [
    ['/', 'Counter'],
    ['/list', 'List'],
    ['/notice', 'Notice'],
]

/**
 * The navigation around a page. Each link marks itself current while
 * `route` matches it.
 */
export function Layout (state:AppState, page:Markup):Markup {
    return html`
        <nav>
            ${LINKS.map(([route, text]) => html`<a
                href=${PREFIX + route}
                aria-current=${() => current(state, route)}
            >${text}</a>`)}
        </nav>
        <main>${page}</main>`
}

function current (state:AppState, route:string):'page'|false {
    return state.route() === route ? 'page' : false
}
