import { test } from '@substrate-system/tapzero'
import { signal, effect } from 'alien-signals'
import { define } from '../src/index.js'

// These tests run under Node with no DOM (see `npm run test:ssr`).
// They verify the server-side-rendering contract: microtags can define
// components and expose the statics needed to build markup without a
// browser. The component lifecycle (connect/setup/refs) is exercised by
// the browser suite in test/index.ts.

test('SSR environment has no DOM globals', t => {
    t.equal(typeof document, 'undefined', 'document is not defined')
    t.equal(typeof HTMLElement, 'undefined', 'HTMLElement is not defined')
    t.equal(
        typeof customElements,
        'undefined',
        'customElements is not defined'
    )
})

test('define().setup() works without a DOM', t => {
    // A throw here (e.g. touching HTMLElement/customElements) fails the
    // test. setup never runs server-side (nothing connects), but its body
    // must still load at define time without a browser.
    const El = define('ssr-widget')
        .withProps(p => ({ start: p.number() }))
        .withRefs(r => ({ display: r.one(), inc: r.one() }))
        .setup(ctx => {
            const count = signal(ctx.props.start())
            effect(() => { count() })  // track the signal
        })

    t.ok(El, 'defining a component returns the element class')
})

test('element class exposes TAG and refs as statics', t => {
    const El = define('ssr-counter')
        .withProps(p => ({ start: p.number() }))
        .withRefs(r => ({ display: r.one(), inc: r.one(), dec: r.one() }))
        .setup(() => {})

    t.equal(El.TAG, 'ssr-counter', 'TAG is the registered tag name')
    t.deepEqual(
        { ...El.refs },
        { display: 'display', inc: 'inc', dec: 'dec' },
        'refs maps each declared key to its own data-ref name'
    )
})

test('TAG and refs build server-rendered markup', t => {
    const El = define('ssr-list')
        .withRefs(r => ({ items: r.all() }))
        .setup(() => {})

    const html = `<${El.TAG} data-ref="${El.refs.items}"></${El.TAG}>`

    t.equal(typeof El.TAG, 'string', 'TAG stringifies for interpolation')
    t.equal(typeof El.refs.items, 'string', 'ref name stringifies')
    t.ok(html.length > 0, 'produces non-empty markup')
    t.ok(
        !html.includes('undefined'),
        'no undefined values leak into the markup'
    )
    t.ok(
        !html.includes('[object'),
        'statics stringify cleanly (not as objects)'
    )
})
