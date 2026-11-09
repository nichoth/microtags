import { html, type Markup } from 'microtags/htm'
import { Notice } from '../components/notice.js'
import { State, type AppState } from '../state.js'

export function NoticePage (state:AppState):Markup {
    return html`
        <h1>Client-rendered notice</h1>
        <button id="show-notice" onclick=${() => State.openNotice(state)}>
            Show notice
        </button>
        ${() => (state.noticeOpen() ?
            html`<${Notice}
                message="This notice was rendered on the client"
                ondismiss=${() => State.dismissNotice(state)}
            />` :
            '')}`
}
