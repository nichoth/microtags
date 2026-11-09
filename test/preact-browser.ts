import { test } from '@substrate-system/tapzero'
import { h, hydrate, render } from 'preact'
import { define } from '../src/index.js'
import { html } from '../src/htm.js'
import { toPreact } from '../src/preact.browser.js'

// Browser tests for the `microtags/preact` browser build. Hydrate
// fixtures are the component's `render` static output, placed with
// `innerHTML` (`test/index.ts` imports the server templater, so render
// support is registered).

const inner = (count:number, label:string) => html`
    <input class="field" data-ref="field" value=${label} />
    <output data-ref="out">${String(count)}</output>
    <button data-ref="bump">+</button>`

/**
 * The full variant: it keeps its render link. Like a real component,
 * its setup only reads its refs (collected before setup) and never
 * renders markup itself.
 */
const PEl = define('preact-browser-el')
    .withProps(p => ({ count: p.number(), label: p.string() }))
    .withRefs(r => ({
        field: r.one<HTMLInputElement>(),
        out: r.one<HTMLOutputElement>(),
        bump: r.one<HTMLButtonElement>(),
    }))
    .render(({ props }) => inner(props.count, props.label))
    .setup(ctx => {
        const { out, bump } = ctx.refs
        ctx.effect(() => { out.textContent = String(ctx.props.count()) })
        ctx.on(bump, 'click', () => {
            ctx.emit('preact-browser-el:bump')
        })
    })

const PC = toPreact(PEl, { events: { onBump: 'preact-browser-el:bump' } })

function container ():HTMLElement {
    const div = document.createElement('div')
    document.body.appendChild(div)
    return div
}

/** A container holding the server render of the component. */
function serverRendered (count:number, label:string):HTMLElement {
    const div = container()
    div.innerHTML = PEl.render({ count, label })
    return div
}

test('preact browser: hydrate keeps the inner nodes', t => {
    const div = serverRendered(1, 'a')
    const input = div.querySelector('input')!
    hydrate(h(PC, { count: 1, label: 'a' }), div)
    t.equal(div.querySelector('input'), input, 'same inner node')
    t.ok(input.isConnected, 'inner node is still connected')
    render(null, div)
    div.remove()
})

test('preact browser: re-render after hydrate sets the prop', t => {
    const div = serverRendered(1, 'a')
    const input = div.querySelector('input')!
    hydrate(h(PC, { count: 1, label: 'a' }), div)
    render(h(PC, { count: 5, label: 'a' }), div)
    const el = div.firstElementChild as InstanceType<typeof PEl>
    t.equal(div.querySelector('input'), input, 'same inner node')
    t.equal(el.count, 5, 'the property returns the new value')
    t.equal(div.querySelector('output')!.textContent, '5',
        'the element reacted to the new value')
    render(null, div)
    div.remove()
})

test('preact browser: a value typed before hydrate survives', t => {
    const div = serverRendered(1, 'a')
    const input = div.querySelector('input')!
    input.value = 'typed'
    hydrate(h(PC, { count: 1, label: 'a' }), div)
    t.equal(div.querySelector('input')!.value, 'typed', 'value kept')
    render(null, div)
    div.remove()
})

test('preact browser: client-only render', t => {
    const div = container()
    render(h(PC, { count: 2, label: 'b' }), div)
    const input = div.querySelector('input')
    t.ok(input, 'the element rendered its inner markup')
    t.equal(input?.value, 'b', 'from the declared props')
    t.equal(div.querySelector('output')?.textContent, '2', 'count shown')
    render(h(PC, { count: 3, label: 'b' }), div)
    t.equal(div.querySelector('input'), input, 'same inner node')
    t.equal(div.querySelector('output')?.textContent, '3', 'count updated')
    render(null, div)
    div.remove()
})

test('preact browser: a mapped callback is called on the event', t => {
    let calls = 0
    const onBump = () => { calls++ }

    const hydrated = serverRendered(1, 'a')
    hydrate(h(PC, { count: 1, label: 'a', onBump }), hydrated)
    hydrated.querySelector('button')!.click()
    t.equal(calls, 1, 'called after hydrate')
    render(null, hydrated)
    hydrated.remove()

    const client = container()
    render(h(PC, { count: 1, label: 'a', onBump }), client)
    client.querySelector('button')!.click()
    t.equal(calls, 2, 'called after a client-only render')
    render(null, client)
    client.remove()
})

test('preact browser: children throw, naming the tag', t => {
    const div = container()
    let err:Error|null = null
    try {
        render(h(PC as any, { count: 1 }, 'kid'), div)
    } catch (e) {
        err = e as Error
    }
    t.ok(err?.message.includes('preact-browser-el'), 'names the tag')
    div.remove()
})

/** A prop-only declared prop: never serialized, never an attribute. */
const PListEl = define('preact-browser-list')
    .withProps(p => ({ items: p.prop<string[]>([]) }))
    .render(() => html`<ul></ul>`)
    .setup(ctx => {
        const ul = ctx.host.querySelector('ul')!
        ctx.effect(() => {
            ul.textContent = ctx.props.items().join(',')
        })
    })

const PList = toPreact(PListEl)

test('preact browser: hydrate assigns a prop-only declared prop', t => {
    const div = container()
    div.innerHTML = PListEl.render({ items: ['a', 'b'] })
    const list = ['a', 'b']
    hydrate(h(PList, { items: list }), div)
    const el = div.firstElementChild as InstanceType<typeof PListEl>
    t.equal(el.items, list, 'the property holds the passed value')
    t.equal(div.querySelector('ul')!.textContent, 'a,b',
        'the element reacted to it')
    render(h(PList, { items: list }), div)
    t.equal(el.items, list, 'a re-render with the same value keeps it')
    const next = ['c']
    render(h(PList, { items: next }), div)
    t.equal(el.items, next, 'a new value is assigned')
    render(null, div)
    div.remove()
})
