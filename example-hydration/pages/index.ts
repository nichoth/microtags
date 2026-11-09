import { html, type Markup } from 'microtags/htm'
import { Counter } from '../components/counter.js'
import { Badge } from '../components/badge.js'
import { State, type AppState } from '../state.js'

export function IndexPage (state:AppState):Markup {
    return html`
        <h1>${state.heading()}</h1>
        <section class="counter-section">
            <${Counter}
                count=${state.count}
                onincrement=${() => State.increase(state)}
                ondecrement=${() => State.decrease(state)}
            >
                <${Badge} label=${state.badgeLabel()} />
            <//>
        </section>`
}
