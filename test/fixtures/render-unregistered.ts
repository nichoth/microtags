// Calls a component's render and renderParts statics with no templater and no server
// render support import. Run as its own process by test/ssr.ts, since
// the SSR suite itself imports the templater.
import { define } from '../../src/index.js'

const El = define('unregistered-el')
    .withProps(p => ({ n: p.number() }))
    .render(({ props }) => `<i>${props.n}</i>`)
    .setup(() => {})

// One line per static: `render`, then `renderParts`.
for (const fn of [El.render, El.renderParts]) {
    try {
        console.log(JSON.stringify(fn({ n: 1 })))
    } catch (err) {
        console.log('threw: ' + (err as Error).message)
    }
}
