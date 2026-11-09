import { mount } from 'microtags/htm'
// Leaf components first. Stripping Counter's render removes its import
// of Badge, so this order is what defines Badge before Counter.
import { Badge } from '../components/badge.js'
import { Notice } from '../components/notice.js'
import { Counter } from '../components/counter.js'
import { Layout } from '../pages/layout.js'
import { pageFor } from '../pages/routes.js'
import { State, STATE_ID } from '../state.js'

const list = document.querySelector('#assertion-results')

assert(
    'Counter.render is removed from client bundle',
    Counter.render === undefined,
    list
)
assert(
    'Notice.render is a function (kept)',
    typeof Notice.render === 'function',
    list
)
assert(
    'Badge.render is a function (kept)',
    typeof Badge.render === 'function',
    list
)

// start from the state the server rendered; malformed JSON throws
const payload = document.getElementById(STATE_ID)?.textContent
const state = State(payload ? JSON.parse(payload) : {})
const root = document.getElementById('root')
if (!root) throw new Error('no #root element')
mount(root, Layout(state, pageFor(state.route())(state)))

function assert (
    name:string,
    pass:boolean,
    list:Element|null
):void {
    if (!list) throw new Error('not list')
    const li = document.createElement('li')
    li.textContent = `${pass ? 'PASS' : 'FAIL'}: ${name}`
    li.style.color = pass ? 'green' : 'red'
    list.appendChild(li)
}
