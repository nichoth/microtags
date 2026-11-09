import { html, type Markup } from 'microtags/htm'
import { Badge } from '../components/badge.js'
import { State, type AppState } from '../state.js'

export function ListPage (state:AppState):Markup {
    return html`
        <h1>Badges from an array</h1>
        <ul class="badge-list">
            ${() => state.labels().map(label => html`<li key=${label}>
                <${Badge} label=${label} />
                <button
                    onclick=${() => State.removeLabel(state, label)}
                >Remove</button>
            </li>`)}
        </ul>
        <button
            id="add-label"
            onclick=${() => State.addLabel(state, nextLabel(state))}
        >Add a label</button>`
}

/** A label not already in the list. */
function nextLabel (state:AppState):string {
    const labels = state.labels()
    let n = labels.length + 1
    while (labels.includes(`label-${n}`)) n++
    return `label-${n}`
}
