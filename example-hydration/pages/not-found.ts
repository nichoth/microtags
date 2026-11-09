import { html, type Markup } from 'microtags/htm'
import type { AppState } from '../state.js'

export function NotFoundPage (_state:AppState):Markup {
    return html`
        <h1>Not found</h1>
        <p>There is no page at this address.</p>`
}
