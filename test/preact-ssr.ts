import { test } from '@substrate-system/tapzero'
import { h } from 'preact'
import { renderToString } from 'preact-render-to-string'
import { define } from '../src/index.js'
import { html } from '../src/htm.js'
import { toPreact } from '../src/preact.js'

// These tests run under Node with no DOM (see `npm run test:preact-ssr`).
// They render the `microtags/preact` adapter with Preact's own
// `renderToString` and compare it with the component's `render` static.
// Preact orders and quotes attributes its own way, so the host start
// tags are compared parsed, and the inner HTML as a string.

interface Host {
    tag:string
    attrs:Record<string, string>
    inner:string
}

const _named:Record<string, string> = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
}

function decode (s:string):string {
    return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e:string) => {
        if (e[0] !== '#') return _named[e.toLowerCase()] ?? m
        return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ?
            parseInt(e.slice(2), 16) :
            parseInt(e.slice(1), 10))
    })
}

/**
 * Parse one host element: its tag name, its attributes as a decoded
 * name -> value map (a bare attribute is the empty string), and the
 * raw HTML between the start tag and the matching end tag.
 */
function parseHost (s:string):Host {
    const start = /^<([a-z][-\w]*)/i.exec(s)
    if (!start) throw new Error('not an element: ' + s)
    const tag = start[1].toLowerCase()
    const attrs:Record<string, string> = {}
    const re = new RegExp(
        '\\s+([^\\s"\'>/=]+)' +
        '(?:\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+)))?',
        'y'
    )
    let i = start[0].length
    for (;;) {
        re.lastIndex = i
        const m = re.exec(s)
        if (!m) break
        attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '')
        i = re.lastIndex
    }
    const close = /^\s*>/.exec(s.slice(i))
    if (!close) throw new Error('unterminated start tag: ' + s)
    i += close[0].length
    const end = `</${tag}>`
    if (!s.endsWith(end)) throw new Error('no end tag: ' + s)
    return { tag, attrs, inner: s.slice(i, s.length - end.length) }
}

const El = define('preact-ssr-el')
    .withProps(p => ({
        n: p.number(),
        s: p.string(),
        on: p.boolean(),
        off: p.boolean(),
        j: p.json<{ a:string }>(),
        internal: p.prop(7),
    }))
    .render(({ props }) => {
        return html`<b>${props.n}</b><i>${props.s}</i>` +
            `<u>${props.internal}</u>`
    })
    .setup(() => {})

const props = {
    n: 3,
    s: 'a"b<c & d',
    on: true,
    off: false,
    j: { a: '<&>"\'' },
    internal: 9,
}

test('toPreact: renderToString matches the render static', t => {
    const C = toPreact(El)
    const got = parseHost(renderToString(h(C, props)))
    const want = parseHost(El.render(props))
    t.equal(got.tag, want.tag, 'same tag')
    t.deepEqual(got.attrs, want.attrs, 'same attribute map')
    t.equal(got.inner, want.inner, 'same inner HTML')
    t.ok(got.inner.includes('<u>9</u>'), 'the prop-only prop is rendered')
})

test('toPreact: a true boolean is bare, false and null are absent', t => {
    const C = toPreact(El)
    const out = renderToString(h(C, {
        n: 1,
        on: true,
        off: false,
        s: null as unknown as string,
    }))
    const { attrs } = parseHost(out)
    t.ok(/<preact-ssr-el[^>]*\son[\s>]/.test(out) && !/\son=/.test(out),
        'the true boolean is a bare attribute')
    t.ok(!('off' in attrs), 'the false boolean is absent')
    t.ok(!('s' in attrs), 'the null prop is absent')
})

test('toPreact: passthrough attrs reach the host, callbacks do not', t => {
    const C = toPreact(El, { events: { onChange: 'preact-ssr-el:change' } })
    const { attrs } = parseHost(renderToString(h(C, {
        n: 2,
        class: 'big',
        id: 'one',
        'aria-label': 'A "label"',
        'data-x': 5,
        onChange: () => {},
    })))
    t.equal(attrs.class, 'big', 'class passes through')
    t.equal(attrs.id, 'one', 'id passes through')
    t.equal(attrs['aria-label'], 'A "label"', 'aria-* passes through')
    t.equal(attrs['data-x'], '5', 'data-* passes through')
    t.ok(!Object.keys(attrs).some(k => /change/i.test(k)),
        'the mapped callback prop is not in the output')
})

function thrown (fn:() => unknown):string {
    try {
        fn()
    } catch (err) {
        return String((err as Error).message)
    }
    return ''
}

test('toPreact: a class with no render link throws naming the tag', t => {
    const Plain = define('preact-ssr-plain')
        .withProps(p => ({ n: p.number() }))
        .setup(() => {})
    const C = toPreact(Plain)
    const msg = thrown(() => renderToString(h(C, { n: 1 })))
    t.ok(msg.includes('preact-ssr-plain'), 'the error names the tag')
    t.ok(/render link/.test(msg), 'the error is about the render link')
})

test('toPreact: children throw naming the tag', t => {
    const C = toPreact(El)
    const msg = thrown(() => renderToString(
        h(C as any, { n: 1 }, h('span', null, 'kid'))
    ))
    t.ok(msg.includes('preact-ssr-el'), 'the error names the tag')
})
