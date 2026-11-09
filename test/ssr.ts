import { spawnSync } from 'node:child_process'
import {
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from '@substrate-system/tapzero'
import { signal, effect } from 'alien-signals'
import { define } from '../src/index.js'
import { transform } from '../src/build.js'
import {
    coerceNumber,
    coerceString,
    coerceBoolean,
    coerceJson,
} from '../src/util.js'

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

test('render link: class exposes render function and props list', t => {
    const El = define('ssr-render-basic')
        .withProps(p => ({
            count: p.number(),
            label: p.string(),
        }))
        .withRefs(r => ({ display: r.one() }))
        .render(({ refs, children }) => {
            return `<span data-ref="${refs.display}">${children}</span>`
        })
        .setup(() => {})

    t.equal(
        typeof El.render,
        'function',
        'static render is a function'
    )
    t.deepEqual(
        El.props,
        ['count', 'label'],
        'static props lists declared prop names in order'
    )
})

test('render: without the support module, both statics throw naming it', t => {
    // A separate process, because this suite imports the templater,
    // which registers the server render support module.
    const code = spawnSync('npx', [
        'esbuild', 'test/fixtures/render-unregistered.ts', '--bundle',
        '--platform=node', '--format=cjs',
    ], { encoding: 'utf8' }).stdout
    const out = spawnSync('node', [], { input: code, encoding: 'utf8' })
        .stdout
    const [render, parts] = out.split('\n')
    t.ok(render.startsWith('threw: '), 'render throws')
    t.ok(render.includes('microtags/render-support'),
        'the error names the support module')
    t.ok(parts.startsWith('threw: '), 'renderParts throws')
    t.ok(parts.includes('microtags/render-support'),
        'the renderParts error names the support module')
})

test('render: static render returns host tag wrapping inner content', t => {
    const El = define('ssr-render-output')
        .withProps(p => ({ count: p.number() }))
        .render(({ props }) => {
            return `<span>${props.count}</span>`
        })
        .setup(() => {})

    const result = El.render({ count: 5 })

    // Parse the output structurally
    const match = result.match(
        /^<([a-z-]+)[^>]*>([\s\S]*)<\/([a-z-]+)>$/
    )
    t.ok(match, 'output is a complete HTML element')
    t.equal(match![1], 'ssr-render-output', 'root tag is the host')
    t.equal(match![3], 'ssr-render-output', 'closing tag matches')
    t.ok(
        match![2].includes('<span>5</span>'),
        'inner content from render function is present'
    )
})

test('render: fn receives props, refs, TAG, children, attrs', t => {
    let captured:Record<string, unknown> = {}

    const El = define('ssr-render-ctx')
        .withProps(p => ({ label: p.string() }))
        .withRefs(r => ({ slot: r.one() }))
        .render((ctx) => {
            captured = {
                propsLabel: ctx.props.label,
                refsSlot: ctx.refs.slot,
                TAG: ctx.TAG,
                children: ctx.children,
                attrsClass: ctx.attrs.class,
            }
            return '<div></div>'
        })
        .setup(() => {})

    El.render(
        { label: 'hello' },
        {
            children: '<em>child</em>',
            attrs: { class: 'big' },
        }
    )

    t.equal(
        captured.propsLabel, 'hello',
        'props are plain values'
    )
    t.equal(
        captured.refsSlot, 'slot',
        'refs matches static refs'
    )
    t.equal(
        captured.TAG, 'ssr-render-ctx',
        'TAG matches'
    )
    t.equal(
        captured.children, '<em>child</em>',
        'children passed through'
    )
    t.equal(
        captured.attrsClass, 'big',
        'attrs passed through'
    )
})

test('render: coercer round-trip for number, string, boolean, json', t => {
    const El = define('ssr-roundtrip')
        .withProps(p => ({
            n: p.number(),
            s: p.string(),
            b: p.boolean(),
            j: p.json<{ x:number }>(),
        }))
        .render(() => '')
        .setup(() => {})

    const html = El.render({
        n: 42,
        s: 'hello',
        b: true,
        j: { x: 99 },
    })

    // Extract attributes from the host tag
    const nMatch = html.match(/\bn="([^"]*)"/)
    const sMatch = html.match(/\bs="([^"]*)"/)
    const bMatch = html.match(/\bb(?:="[^"]*"|\s|>)/)
    const jMatch = html.match(/\bj="([^"]*)"/)

    // Verify round-trip: parse back with coercers
    t.equal(
        coerceNumber(nMatch![1]),
        42,
        'number round-trips'
    )
    t.equal(
        coerceString(sMatch![1]),
        'hello',
        'string round-trips'
    )
    // boolean: bare attribute means present
    t.ok(bMatch, 'boolean true emits attribute')
    t.equal(
        coerceBoolean(''),
        true,
        'boolean round-trips'
    )
    // json: decode the HTML entities first
    const jRaw = jMatch![1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
    t.deepEqual(
        coerceJson(jRaw),
        { x: 99 },
        'json round-trips'
    )
})

test('render: boolean true is bare, false/null/undefined omit, prop-only omits, schema uses String', t => {
    const El = define('ssr-attr-rules')
        .withProps(p => ({
            on: p.boolean(),
            off: p.boolean(),
            missing: p.string(),
            internal: p.prop(42),
            count: p.number(),
        }))
        .render(() => '')
        .setup(() => {})

    const html = El.render({
        on: true,
        off: false,
        missing: undefined as unknown as string,
        internal: 42,
        count: null as unknown as number,
    })

    // bare attribute for true
    t.ok(
        /\bon(?:\s|>)/.test(html),
        'true emits bare attribute'
    )
    // false omits
    t.ok(
        !html.includes('off'),
        'false omits attribute'
    )
    // undefined omits
    t.ok(
        !html.includes('missing'),
        'undefined omits attribute'
    )
    // prop-only never emits
    t.ok(
        !html.includes('internal'),
        'prop-only never emits attribute'
    )
    // null omits
    t.ok(
        !html.includes('count'),
        'null omits attribute'
    )
})

test('render: schema prop emits String(value)', t => {
    const numSchema = {
        '~standard': {
            version: 1 as const,
            vendor: 'test',
            validate: (value:unknown) => {
                const n = Number(value)
                return isNaN(n) ?
                    { issues: [{ message: 'bad' }] } :
                    { value: n }
            },
        },
    }

    const El = define('ssr-schema-attr')
        .withProps(p => ({ val: p.schema(numSchema) }))
        .render(() => '')
        .setup(() => {})

    const html = El.render({ val: 123 })
    t.ok(
        html.includes('val="123"'),
        'schema prop serialized with String()'
    )
})

test('render: attribute values with special chars are escaped', t => {
    const El = define('ssr-escape')
        .withProps(p => ({ label: p.string() }))
        .render(() => '')
        .setup(() => {})

    const special = '<script>"alert(\'xss\')&</script>'
    const html = El.render({ label: special })

    // The attribute value should not contain raw special chars
    const attrMatch = html.match(/label="([^"]*)"/)
    t.ok(attrMatch, 'label attribute present')
    const escaped = attrMatch![1]
    t.ok(!escaped.includes('<'), 'no raw <')
    t.ok(!escaped.includes('>'), 'no raw >')
    t.ok(!escaped.includes('"'), 'no raw "')
    t.ok(!escaped.includes("'"), "no raw '")
    // & should only appear as entity prefix
    t.ok(
        !escaped.match(/&(?!amp;|lt;|gt;|quot;|#39;)/),
        'no raw & (only escaped entities)'
    )

    // Round-trip: unescape and compare
    const unescaped = escaped
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
    t.equal(unescaped, special, 'round-trips after unescaping')
})

test('render: client:true option changes nothing', t => {
    const El = define('ssr-client-true')
        .withProps(p => ({ n: p.number() }))
        .render(() => '<b>hi</b>', { client: true })
        .setup(() => {})

    t.equal(typeof El.render, 'function', 'render is a function')
    t.deepEqual(El.props, ['n'], 'props list present')
    const html = El.render({ n: 5 })
    t.ok(
        html.includes('<b>hi</b>'),
        'output contains render content'
    )
    t.ok(
        html.includes('n="5"'),
        'attribute serialized normally'
    )
})

// Attribute names on the opening host tag, in order.
function hostAttrNames (out:string):string[] {
    const open = out.slice(0, out.indexOf('>') + 1)
    const names:string[] = []
    const re = /\s([^\s=>]+)(?:="[^"]*")?/g
    let m:RegExpExecArray | null
    while ((m = re.exec(open))) names.push(m[1])
    return names
}

test('render: host tag skips extra attributes with invalid names', t => {
    const El = define('ssr-bad-attr-name')
        .withProps(p => ({ n: p.number() }))
        .render(() => '')
        .setup(() => {})

    const out = El.render({ n: 1 }, {
        attrs: {
            'data-ok': 'yes',
            'x" onload="alert(1)': 'bad',
            'a b': 'bad',
            '1st': 'bad',
            '': 'bad',
            'x:y.z_w': 'ok',
        },
    })

    t.deepEqual(
        hostAttrNames(out),
        ['n', 'data-ok', 'x:y.z_w'],
        'only valid extra attribute names reach the host tag'
    )
    t.ok(!out.includes('onload'), 'hostile key does not break out')
})

test('render: declared props serialize unchanged, names unvalidated', t => {
    // `$odd` is outside the attribute grammar, but declared prop names
    // come from the builder chain, not data, so they are not checked.
    const El = define('ssr-declared-names')
        .withProps(p => ({
            n: p.number(),
            on: p.boolean(),
            s: p.string(),
            j: p.json<{ a:string }>(),
            $odd: p.string(),
        }))
        .render(() => '')
        .setup(() => {})

    const out = El.render(
        { n: 3, on: true, s: 'a"b', j: { a: '<' }, $odd: 'v' },
        { attrs: { 'data-x': '1' } }
    )

    t.equal(
        out,
        '<ssr-declared-names n="3" on s="a&quot;b"' +
            ' j="{&quot;a&quot;:&quot;&lt;&quot;}" $odd="v"' +
            ' data-x="1"></ssr-declared-names>',
        'declared props serialize exactly as before'
    )
})

test('render: a declared prop wins over an extra attr of its name', t => {
    // Changed in 0.1.0: the host used to repeat the name
    // (`n="1" n="2"`). An HTML parser keeps the first, so the declared
    // value is the one that counts; now it is the only one emitted.
    const El = define('ssr-dup-attr')
        .withProps(p => ({ n: p.number(), m: p.prop(0) }))
        .render(() => '')
        .setup(() => {})

    t.equal(
        El.render({ n: 1, m: 5 }, { attrs: { n: '2' } }),
        '<ssr-dup-attr n="1"></ssr-dup-attr>',
        'one attribute, the declared value'
    )
    t.equal(
        El.render({ n: 1, m: 5 }, { attrs: { m: '2' } }),
        '<ssr-dup-attr n="1" m="2"></ssr-dup-attr>',
        'a prop-only prop leaves the extra attr in place'
    )
})

// html templater SSR tests (no DOM)
import { html, h, raw, Markup } from '../src/htm.js'
import { parityCases, stripMarkers } from './parity.js'

// Render parts: the same render as `render`, split into tag, serialized
// (unescaped) host attributes and inner HTML.
const _partsEsc:Record<string, string> = {
    '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;',
}

function assembleParts (p:{
    tag:string
    attrs:Record<string, string>
    html:string
}):string {
    let a = ''
    for (const [k, v] of Object.entries(p.attrs)) {
        a += v === '' ?
            ` ${k}` :
            ` ${k}="${v.replace(/[&"'<>]/g, c => _partsEsc[c])}"`
    }
    return `<${p.tag}${a}>${p.html}</${p.tag}>`
}

const _partsSchema = {
    '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (v:unknown) => ({ value: Number(v) }),
    },
}

const PartsEl = define('ssr-parts')
    .withProps(p => ({
        n: p.number(),
        s: p.string(),
        on: p.boolean(),
        off: p.boolean(),
        j: p.json<{ a:string }>(),
        sch: p.schema(_partsSchema),
        internal: p.prop(7),
        gone: p.string(),
    }))
    .render(({ props, children }) => {
        return html`<b>${props.n}</b><i>${raw(children)}</i>`
    })
    .setup(() => {})

const partsProps = {
    n: 3,
    s: 'a"b<c',
    on: true,
    off: false,
    j: { a: '<&>' },
    sch: 12,
    internal: 7,
    gone: null as unknown as string,
}

const partsOpts = {
    children: '<em>kid</em>',
    attrs: {
        'data-x': '1 & 2',
        class: 'big',
        'x" onload="alert(1)': 'bad',
        'a b': 'bad',
    },
}

test('renderParts: assembled parts equal render byte for byte', t => {
    const parts = PartsEl.renderParts(partsProps, partsOpts)
    t.equal(parts.tag, 'ssr-parts', 'tag is the host tag name')
    t.equal(
        assembleParts(parts),
        PartsEl.render(partsProps, partsOpts),
        'the host string built from the parts is the render output'
    )
    t.equal(
        assembleParts(PartsEl.renderParts({ n: 1 } as typeof partsProps)),
        PartsEl.render({ n: 1 } as typeof partsProps),
        'the same with no options and missing props'
    )
})

test('renderParts: attrs hold declared props, then valid extra attrs', t => {
    const { attrs } = PartsEl.renderParts(partsProps, partsOpts)
    t.deepEqual(
        Object.keys(attrs),
        ['n', 's', 'on', 'j', 'sch', 'data-x', 'class'],
        'declared props first, then extra attrs; no prop-only, null,' +
            ' false or invalid names'
    )
    t.equal(attrs.s, 'a"b<c', 'values are serialized, not escaped')
    t.equal(attrs.j, '{"a":"<&>"}', 'json is serialized')
    t.equal(attrs.sch, '12', 'schema uses String')
    t.equal(attrs['data-x'], '1 & 2', 'extra attr value is kept')
})

test('renderParts: a true boolean is the empty string', t => {
    const { attrs } = PartsEl.renderParts(partsProps, partsOpts)
    t.equal(attrs.on, '', 'true boolean serializes to the empty string')
})

test('renderParts: a class with no render link has no renderParts', t => {
    const Plain = define('ssr-parts-none')
        .withProps(p => ({ n: p.number() }))
        .setup(() => {})
    t.ok(!('renderParts' in Plain), 'defined without a render link')

    // The build transform strips the render link from this source.
    const src = readFileSync('test/fixtures/strip-render.ts', 'utf8')
    const out = transform(src).code
    t.ok(!out.includes('.render('), 'the transform stripped the link')
    // Run the stripped module in its own process, with `microtags`
    // pointed at the source.
    const dir = mkdtempSync(join(tmpdir(), 'mt-parts-'))
    const file = join(dir, 'stripped.ts')
    writeFileSync(file, out + '\nconsole.log(' +
        'typeof Counter.renderParts, typeof Counter.render, Counter.TAG)')
    const code = spawnSync('npx', [
        'esbuild', file, '--bundle', '--platform=node', '--format=cjs',
        '--alias:microtags=' + resolve('src/index.ts'),
    ], { encoding: 'utf8' }).stdout
    const ran = spawnSync('node', [], { input: code, encoding: 'utf8' })
        .stdout.trim()
    rmSync(dir, { recursive: true })
    t.equal(ran, 'undefined undefined test-counter',
        'the stripped class has neither renderParts nor render')
})

test('html SSR: html, h, raw return markup with no DOM', t => {
    const result = html`<div class="box">hello</div>`
    t.ok(result instanceof Markup, 'html returns markup')
    t.equal(
        String(result), '<div class="box">hello</div>',
        'markup stringifies to the same HTML as before'
    )
    t.equal(result.toString(), String(result), 'toString matches')

    const hResult = h('span', { id: 'x' }, 'text')
    t.equal(
        typeof String(hResult), 'string',
        'h result stringifies'
    )

    const rResult = raw('<em>hi</em>')
    t.equal(
        typeof String(rResult), 'string',
        'raw result stringifies'
    )
})

test('html SSR: element class renders in Node', t => {
    const El = define('ssr-html-comp')
        .withProps(p => ({ n: p.number() }))
        .render(({ props }) => `<b>${props.n}</b>`)
        .setup(() => {})

    const result = String(html`<${El} n=${7} />`)
    t.ok(
        result.includes('ssr-html-comp'),
        'contains host tag'
    )
})

test('html SSR: escaping works without DOM', t => {
    const danger = '<img onerror=alert(1)>'
    const result = String(html`<div>${danger}</div>`)
    t.ok(
        !result.includes('<img'),
        'dangerous markup escaped'
    )
})

test('html SSR: nested markup is not escaped again', t => {
    const inner = html`<em>${'a&b'}</em>`
    const outer = String(html`<p>${inner}</p>`)
    t.equal(outer, '<p><em>a&amp;b</em></p>', 'inner escaped once')
    const viaRaw = String(html`<p>${raw('<i>x</i>')}</p>`)
    t.equal(viaRaw, '<p><i>x</i></p>', 'raw passes through')
})

test('html SSR: array of markup in child position flattens', t => {
    const items = ['a', 'b'].map(x => html`<li>${x}</li>`)
    t.equal(
        String(html`<ul>${items}</ul>`),
        '<ul><li>a</li><li>b</li></ul>',
        'array flattens'
    )
    t.equal(
        String(html`<li>a</li><li>b</li>`),
        '<li>a</li><li>b</li>',
        'top-level fragment flattens'
    )
})

test('html SSR: render returning markup matches render returning string',
    t => {
        const A = define('ssr-markup-a')
            .withProps(p => ({ n: p.number() }))
            .render(({ props }) => html`<b>${props.n}</b>`)
            .setup(() => {})
        const B = define('ssr-markup-b')
            .withProps(p => ({ n: p.number() }))
            .render(({ props }) => `<b>${props.n}</b>`)
            .setup(() => {})
        const a = String(html`<${A} n=${3} />`)
        const b = String(html`<${B} n=${3} />`)
        t.equal(
            a.replace(/ssr-markup-a/g, 'X'),
            b.replace(/ssr-markup-b/g, 'X'),
            'same host HTML'
        )
        t.equal(A.render({ n: 3 }), html`<${A} n=${3} />`.toString(),
            'static render returns the host string')
    })

test('html SSR: declared string prop is escaped exactly once', t => {
    const El = define('ssr-markup-esc')
        .withProps(p => ({ label: p.string() }))
        .render(({ props }) => html`<span>${props.label}</span>`)
        .setup(() => {})
    const out = String(html`<${El} label=${'a&b'} />`)
    t.ok(out.includes('label="a&amp;b"'), 'attribute escaped once')
    t.ok(out.includes('<span>a&amp;b</span>'), 'child escaped once')
    t.ok(!out.includes('&amp;amp;'), 'never double escaped')
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

// Reactive holes on the server: evaluated once, child holes marked.
test('html SSR: signal in child position is wrapped in markers', t => {
    const s = signal('hi')
    t.equal(
        String(html`<p>${s}</p>`),
        '<p><!--[-->hi<!--]--></p>',
        'signal value between one marker pair'
    )
})

test('html SSR: function child is called once and wrapped', t => {
    let calls = 0
    const f = () => { calls++; return html`<b>x</b>` }
    t.equal(String(html`<p>${f}</p>`), '<p><!--[--><b>x</b><!--]--></p>',
        'markup result wrapped')
    t.equal(calls, 1, 'called once')
    t.equal(
        String(html`<p>${() => [html`<i>a</i>`, 'b&']}</p>`),
        '<p><!--[--><i>a</i>b&amp;<!--]--></p>',
        'array result flattened and strings escaped'
    )
    t.equal(String(html`<p>${() => null}</p>`), '<p><!--[--><!--]--></p>',
        'null result leaves an empty region')
    t.equal(String(html`<p>${() => false}</p>`), '<p><!--[--><!--]--></p>',
        'false result leaves an empty region')
})

test('html SSR: reactive attribute on a plain element', t => {
    t.equal(String(html`<a href=${signal('/x')}>a</a>`),
        '<a href="/x">a</a>', 'signal attribute evaluated')
    t.equal(String(html`<a title=${() => 'a"b'}>a</a>`),
        '<a title="a&quot;b">a</a>', 'function attribute evaluated')
    for (const v of [false, null, undefined]) {
        t.equal(String(html`<a title=${() => v}>a</a>`), '<a>a</a>',
            `${v} omits the attribute`)
    }
})

test('html SSR: signal component prop reaches render as a value', t => {
    let seen:unknown
    const El = define('ssr-reactive-prop')
        .withProps(p => ({ n: p.number() }))
        .render(({ props }) => { seen = props.n; return '' })
        .setup(() => {})
    const out = String(html`<${El} n=${signal(4)} />`)
    t.equal(seen, 4, 'render saw the plain value')
    t.ok(out.includes('n="4"'), 'attribute serialized from the value')
})

test('html SSR: component children wrapped in a children marker', t => {
    let got = ''
    const Keep = define('ssr-children-keep')
        .render(({ children }) => { got = String(children); return got })
        .setup(() => {})
    html`<${Keep}><i>a</i></${Keep}>`
    t.equal(got, '<!--[c--><i>a</i><!--]-->', 'children arrive wrapped')
    html`<${Keep} />`
    t.equal(got, '', 'no children, no markers')

    const Drop = define('ssr-children-drop')
        .render(() => '<b>x</b>')
        .setup(() => {})
    const out = String(html`<${Drop}><i>a</i></${Drop}>`)
    t.ok(!out.includes('<!--['), 'dropping children emits no markers')
})

test('html SSR: function-valued on<event> props are omitted', t => {
    const El = define('ssr-onevent')
        .render(() => '')
        .setup(() => {})
    const fn = () => {}
    t.equal(String(html`<button onclick=${fn}>b</button>`),
        '<button>b</button>', 'omitted on plain element')
    t.ok(!String(html`<${El} onfoo=${fn} />`).includes('onfoo'),
        'omitted on host')
})

test('html SSR: static page output is unchanged', t => {
    const El = define('ssr-static-page')
        .withProps(p => ({ n: p.number() }))
        .render(({ props }) => html`<b>${props.n}</b>`)
        .setup(() => {})
    t.equal(
        String(html`<main id="m"><h1 class=${'t'}>${'a&b'}</h1></main>`),
        '<main id="m"><h1 class="t">a&amp;b</h1></main>',
        'plain elements'
    )
    t.equal(String(html`<div>${[html`<${El} n=${2} />`]}</div>`),
        '<div><ssr-static-page n="2"><b>2</b></ssr-static-page></div>',
        'component without children')
})

// A spread of untrusted keys must not break out of the tag.
const BAD_KEY = 'x" onload="alert(1)'

test('html SSR: a spread skips an invalid attribute name', t => {
    const attrs = { [BAD_KEY]: 'v', 'data-ok': 'yes' }
    t.equal(String(html`<div ...${attrs}></div>`),
        '<div data-ok="yes"></div>',
        'invalid key omitted, valid key emitted')
})

test('html SSR: a component skips an invalid extra attribute name', t => {
    let seen:Record<string, string> | undefined
    const El = define('ssr-bad-attr')
        .render(({ attrs }) => { seen = attrs; return '' })
        .setup(() => {})
    const attrs = { [BAD_KEY]: 'v', 'data-ok': 'yes' }
    const out = String(html`<${El} ...${attrs} />`)
    t.equal(out, '<ssr-bad-attr data-ok="yes"></ssr-bad-attr>',
        'host tag has only the valid attribute')
    t.ok(seen && !(BAD_KEY in seen), 'render was not given the key')
})

test('html SSR: an unclosed void element with children throws', async t => {
    await t.throws(
        () => html`<form><input type="text"><button>go</button></form>`,
        /input/,
        'error names the tag'
    )
    await t.throws(() => html`<div><br> </div>`, /br/,
        'whitespace text counts as a child')
})

test('html SSR: a self-closed void element does not throw', t => {
    const out = String(html`<form><input type="text" /><b>go</b></form>`)
    t.ok(!out.includes('</input>'), 'no closing tag')
    t.ok(out.includes('<b>go</b>'), 'following content kept')
})

// The browser templater has its own `Markup` class, so it stands in
// for a second copy of the package.
import { html as bhtml, raw as braw } from '../src/htm.browser.js'

test('html SSR: markup from another copy is not escaped', t => {
    const Keep = define('ssr-other-copy')
        .render(({ children }) => html`<p>${raw(String(children))}</p>`)
        .setup(() => {})
    const cases:[string, unknown, unknown][] = [
        ['child', bhtml`<i>a</i>`, html`<i>a</i>`],
        ['raw child', braw('<b>x</b>'), raw('<b>x</b>')],
        ['region', () => bhtml`<i>a</i>`, () => html`<i>a</i>`],
        ['list', [bhtml`<i>a</i>`], [html`<i>a</i>`]],
    ]
    for (const [name, other, same] of cases) {
        t.equal(
            String(html`<div>${other}</div>`),
            String(html`<div>${same}</div>`),
            `${name} renders as with one copy`
        )
    }
    t.equal(
        String(html`<${Keep}>${bhtml`<i>a</i>`}</${Keep}>`),
        String(html`<${Keep}>${html`<i>a</i>`}</${Keep}>`),
        'component children render as with one copy'
    )
    t.equal(
        String(html`${bhtml`<i>a</i>`}`),
        String(html`<i>a</i>`),
        'a lone hole renders as with one copy'
    )
})

test('html SSR: server markup in the other copy is not escaped', t => {
    t.equal(
        String(bhtml`<div>${html`<i>a</i>`}</div>`),
        String(bhtml`<div>${bhtml`<i>a</i>`}</div>`),
        'nested server markup is HTML'
    )
})

test('parity table: server output matches the expected HTML', t => {
    for (const c of parityCases) {
        t.equal(
            stripMarkers(String(c.input(html))),
            c.expected,
            c.name
        )
    }
})
