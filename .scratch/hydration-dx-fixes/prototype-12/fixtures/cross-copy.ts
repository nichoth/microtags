// Core from one copy of the package, the server templater from another.
import { define } from 'microtags'
import { html } from 'copy2/htm'

const X = define('x-cross')
    .withProps(p => ({ open: p.boolean(), n: p.number() }))
    .render(({ props }) => `<i>${props.n}</i>`)
    .setup(() => {})
try {
    console.log('rendered', String(html`<${X} open=${true} n=${2} />`))
} catch (err) {
    console.log('threw', (err as Error).message)
}
