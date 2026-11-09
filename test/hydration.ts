import { test } from '@substrate-system/tapzero'
import * as fs from 'fs'
import * as path from 'path'
import type {
    createApp as CreateApp
} from '../example-hydration/server/app.js'
import { pathToFileURL } from 'url'
import type { Serialized } from 'microtags'
import {
    assemble,
    stateScript,
} from '../example-hydration/server/scaffold.js'
import { Layout } from '../example-hydration/pages/layout.js'
import {
    State,
    serialize,
    type AppState,
} from '../example-hydration/state.js'
import {
    pageFor,
    IndexPage,
    NotFoundPage,
} from '../example-hydration/pages/routes.js'

// the built app, from `npm run build:hydration`; loaded at runtime so
// the bundler leaves the build output alone
const builtApp = pathToFileURL(
    path.resolve('example-hydration/build/server/app.js')
).href
const createApp:typeof CreateApp = (await import(builtApp)).createApp

// Node request tests for the hydration example's Hono app. They go
// through `app.request()`, so no port is bound. See
// `npm run test:hydration`, which builds first.

const scaffold = fs.readFileSync(
    path.resolve('example-hydration/index.html'),
    'utf8'
)
const MARKER = '<!--microtags:main-->'

const STATE_MARKER = '<!--microtags:state-->'
const STATE_RE =
    /<script\b[^>]*\bid="microtags-state"[^>]*>([\s\S]*?)<\/script>/g

function stateScripts (page:string):string[] {
    return [...page.matchAll(STATE_RE)].map(m => m[1])
}

function payload (page:string):Serialized<AppState> {
    return JSON.parse(stateScripts(page)[0])
}

function hostHasChildren (page:string, tag:string):boolean {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)
    const inner = page.match(re)?.[1] ?? ''
    return /<[a-z]/i.test(inner)
}

test('GET /example-hydration/ returns a complete html page', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration/')
    const page = await res.text()

    t.equal(res.status, 200, 'status is 200')
    t.ok(
        (res.headers.get('content-type') ?? '').startsWith('text/html'),
        'content type is text/html'
    )
    t.ok(!page.includes(MARKER), 'the outlet marker is replaced')
    t.ok(hostHasChildren(page, 'hydra-counter'), 'counter host has children')
    t.ok(hostHasChildren(page, 'hydra-badge'), 'badge host has children')
    t.ok(/^<!DOCTYPE html>/i.test(page.trim()), 'scaffold owns the doctype')
})

/** The whole document the server would send for `state`. */
function render (state:AppState):string {
    const body = pageFor(state.route())(state)
    return assemble(
        scaffold,
        String(Layout(state, body)),
        stateScript(serialize(state))
    )
}

test('every page is exactly a render of its serialized state', async t => {
    // extra options must not reach the page: the browser never sees them
    const opts = {
        loadScaffold: () => scaffold,
        index: { heading: 'server only', label: 'server only' },
    }
    const app = createApp(opts)
    const paths = ['/', '/?count=12', '/index.html', '/list', '/notice',
        '/nope']
    for (const path of paths) {
        const page = await (
            await app.request('/example-hydration' + path)
        ).text()
        t.equal(page, render(State(payload(page))),
            `${path} renders from its payload alone`)
    }
})

test('body text with special characters is escaped exactly once', async t => {
    const nasty = '<b>"Tom" & \'Jerry\'</b> $& $1'
    const page = render(State({ heading: nasty, badgeLabel: nasty }))
    const escaped = '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;' +
        '&lt;/b&gt; $&amp; $1'

    t.ok(!page.includes(nasty), 'raw markup does not reach the page')
    t.ok(page.includes(escaped), 'text is escaped and `$&` is literal')
    t.ok(!page.includes('&amp;amp;'), 'nothing is escaped twice')
    t.ok(!page.includes(MARKER), 'marker is not re-inserted by `$&`')
})

test('a scaffold without exactly one marker fails assembly', async t => {
    const none = scaffold.replace(MARKER, '')
    const two = scaffold.replace(MARKER, MARKER + MARKER)

    for (const [name, bad] of [['zero', none], ['two', two]]) {
        const app = createApp({ loadScaffold: () => bad })
        const res = await app.request('/example-hydration/')
        const page = await res.text()
        t.equal(res.status, 500, `${name} markers is a server error`)
        t.ok(!page.includes('<main'), `${name} markers returns no page`)
    }
})

function isHtml (res:Response):boolean {
    return (res.headers.get('content-type') ?? '').startsWith('text/html')
}

test('GET /example-hydration/list renders several badges', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration/list')
    const page = await res.text()

    t.equal(res.status, 200, 'status is 200')
    t.ok(isHtml(res), 'content type is text/html')
    t.ok(!page.includes(MARKER), 'the outlet marker is replaced')
    const badges = page.match(/<hydra-badge\b[^>]*>[\s\S]*?<\/hydra-badge>/g)
    t.ok((badges ?? []).length > 1, 'several badge hosts')
    t.ok(
        (badges ?? []).every(b => hostHasChildren(b, 'hydra-badge')),
        'every badge host has children'
    )
})

test('list response has one keyed item per label in state', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration/list')
    const page = await res.text()
    const json = page.match(
        /<script[^>]*id="microtags-state"[^>]*>([\s\S]*?)<\/script>/
    )?.[1]
    const labels:string[] = JSON.parse(json ?? '{}').labels
    t.ok(labels.length > 1, 'state has several labels')
    const keys = [...page.matchAll(/<li\b[^>]*\bkey="([^"]*)"/g)]
        .map(m => m[1])
    t.deepEqual(keys, labels, 'one keyed item per label, in order')
})

test('GET /example-hydration/notice has the button, no notice', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration/notice')
    const page = await res.text()

    t.equal(res.status, 200, 'status is 200')
    t.ok(isHtml(res), 'content type is text/html')
    t.ok(!page.includes(MARKER), 'the outlet marker is replaced')
    t.ok(/<button\b[^>]*\bid="show-notice"/.test(page), 'has the button')
    t.ok(!/<hydra-notice\b/.test(page), 'no notice host while closed')
    const json = page.match(
        /<script\b[^>]*id="microtags-state"[^>]*>([\s\S]*?)<\/script>/
    )?.[1] ?? '{}'
    t.equal(JSON.parse(json).noticeOpen, false, 'state says it is closed')
})

test('an unknown path returns the scaffold with a 404', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration/nope')
    const page = await res.text()

    t.equal(res.status, 404, 'status is 404')
    t.ok(isHtml(res), 'content type is text/html')
    t.ok(/<nav\b/.test(page), 'nav is present')
    t.ok(/<main\b/.test(page), 'main is present')
    t.ok(!page.includes(MARKER), 'the outlet marker is replaced')
})

test('a path outside the prefix is the not-found page', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    for (const path of ['/list', '/', '/example-hydrationx/list']) {
        const res = await app.request(path)
        const page = await res.text()
        t.equal(res.status, 404, `${path} status is 404`)
        t.equal(pageFor(payload(page).route), NotFoundPage,
            `${path} state carries the not-found route`)
        t.deepEqual(currentLinks(page), [], `${path} marks no link`)
    }
})

test('the bare prefix redirects to the canonical index', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const res = await app.request('/example-hydration')

    t.ok(res.status >= 300 && res.status < 400, 'status is a redirect')
    t.equal(
        new URL(res.headers.get('location') ?? '', 'http://x').pathname,
        '/example-hydration/',
        'location is the index'
    )
})

test('every route carries one state script before the module', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const routes = ['/', '/index.html', '/list', '/notice', '/nope']
    for (const route of routes) {
        const page = await (
            await app.request('/example-hydration' + route)
        ).text()
        const scripts = stateScripts(page)
        t.equal(scripts.length, 1, `${route} has one state script`)
        t.ok(!page.includes(STATE_MARKER), `${route} state marker replaced`)
        const stateAt = page.search(STATE_RE)
        const moduleAt = page.search(/<script\b[^>]*\btype="module"/)
        t.ok(stateAt > -1 && stateAt < moduleAt,
            `${route} state comes before the module script`)
        const parsed = JSON.parse(scripts[0])
        t.deepEqual(serialize(State(parsed)), parsed,
            `${route} payload round-trips through State`)
    }
})

test('route in the payload is the path without the prefix', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const cases:[string, string][] = [
        ['/', '/'],
        ['/index.html', '/'],
        ['/list', '/list'],
        ['/notice', '/notice'],
        ['/nope/deeper', '/nope/deeper'],
    ]
    for (const [path, route] of cases) {
        const page = await (
            await app.request('/example-hydration' + path)
        ).text()
        t.equal(payload(page).route, route, `${path} route is ${route}`)
    }
})

test('a valid count query parameter is reflected in state', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const page = await (
        await app.request('/example-hydration/?count=12')
    ).text()
    t.equal(payload(page).count, 12, 'count is 12')
})

test('an invalid count falls back to the default', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    for (const bad of ['1.5', 'Infinity', 'NaN', 'abc', '', '1e400']) {
        const page = await (
            await app.request('/example-hydration/?count=' +
                encodeURIComponent(bad))
        ).text()
        t.equal(payload(page).count, 5, `count=${bad} falls back to 5`)
    }
})

test('a script closing tag in the path cannot escape the payload', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const evil = '/</script><script>alert(1)</script>'
    const page = await (
        await app.request('/example-hydration' + evil)
    ).text()
    const scripts = stateScripts(page)
    t.equal(scripts.length, 1, 'one state script')
    t.equal(JSON.parse(scripts[0]).route, evil,
        'the payload parses and keeps the path')
})

test('assemble requires exactly one of each marker', t => {
    const cases:[string, string][] = [
        ['no page marker', scaffold.replace(MARKER, '')],
        ['two page markers', scaffold.replace(MARKER, MARKER + MARKER)],
        ['no state marker', scaffold.replace(STATE_MARKER, '')],
        ['two state markers',
            scaffold.replace(STATE_MARKER, STATE_MARKER + STATE_MARKER)],
    ]
    for (const [name, bad] of cases) {
        t.throws(() => assemble(bad, '', ''), name + ' throws')
    }
    t.ok(assemble(scaffold, '', ''), 'a good scaffold assembles')
})

test('State fills defaults for missing keys', t => {
    const full = serialize(State())
    t.deepEqual(
        Object.keys(full).sort(),
        ['badgeLabel', 'count', 'heading', 'labels', 'noticeOpen',
            'route'],
        'every key is present'
    )
    const partial = serialize(State({ count: 9 }))
    t.equal(partial.count, 9, 'given key is kept')
    t.deepEqual(
        { ...partial, count: full.count },
        full,
        'missing keys get defaults'
    )
})

test('each static mutator changes only its own signal', t => {
    type Case = [
        keyof AppState,
        (s:AppState) => void,
        Partial<Serialized<AppState>>?
    ]
    const cases:Case[] = [
        ['count', s => State.increase(s)],
        ['count', s => State.decrease(s)],
        ['noticeOpen', s => State.openNotice(s), { noticeOpen: false }],
        ['noticeOpen', s => State.dismissNotice(s), { noticeOpen: true }],
        ['labels', s => State.addLabel(s, 'delta')],
        ['labels', s => State.removeLabel(s, 'alpha')],
    ]
    for (const [key, mutate, input] of cases) {
        const s = State(input)
        const before = serialize(s)
        mutate(s)
        const after = serialize(s)
        t.notDeepEqual(after[key], before[key], `${key} changed`)
        t.deepEqual({ ...after, [key]: before[key] }, before,
            `only ${key} changed`)
    }
})

const ROOT_RE = new RegExp('<div\\b[^>]*\\bid="root"[^>]*>' +
    '([\\s\\S]*?)</div>\\s*<section\\b[^>]*class="assertions"')

test('the root element holds the navigation and the page', async t => {
    t.ok(!/<nav\b/.test(scaffold), 'the scaffold file has no nav')
    const app = createApp({ loadScaffold: () => scaffold })
    for (const route of ['/', '/list', '/notice', '/nope']) {
        const page = await (
            await app.request('/example-hydration' + route)
        ).text()
        const root = page.match(ROOT_RE)?.[1] ?? ''
        t.ok(/<nav\b/.test(root), `${route} root has the nav`)
        t.ok(/<main\b/.test(root), `${route} root has main`)
        t.equal((page.match(/<nav\b/g) ?? []).length, 1,
            `${route} has one nav`)
    }
})

function currentLinks (page:string):string[] {
    return [...page.matchAll(/<a\b[^>]*>/g)]
        .map(m => m[0])
        .filter(a => /\baria-current=/.test(a))
        .map(a => a.match(/\bhref="([^"]*)"/)?.[1] ?? '')
}

test('the link for the current route carries aria-current', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const cases:[string, string][] = [
        ['/', '/example-hydration/'],
        ['/index.html', '/example-hydration/'],
        ['/list', '/example-hydration/list'],
        ['/notice', '/example-hydration/notice'],
    ]
    for (const [route, href] of cases) {
        const page = await (
            await app.request('/example-hydration' + route)
        ).text()
        t.deepEqual(currentLinks(page), [href], `${route} marks ${href}`)
    }
    const missing = await (
        await app.request('/example-hydration/nope')
    ).text()
    t.deepEqual(currentLinks(missing), [], '404 marks no link')
})

test('the route table falls back to the not-found page', async t => {
    t.equal(pageFor('/nope'), NotFoundPage, 'unknown route is not found')
    t.equal(pageFor('/'), IndexPage, 'index route is the index page')
    t.notEqual(pageFor('/list'), NotFoundPage, 'list is a known route')
})

test('the counter host on the index route has no start attribute', async t => {
    const app = createApp({ loadScaffold: () => scaffold })
    const page = await (await app.request('/example-hydration/')).text()
    const open = page.match(/<hydra-counter\b[^>]*>/)?.[0] ?? ''
    t.ok(open, 'the counter host is rendered')
    t.ok(!/\sstart=/.test(open), 'no start attribute on the host')
    t.ok(/\scount=/.test(open), 'the count prop is serialized')
})

// Built-asset isolation. Each marker is a fixed string that must not
// reach the client build, paired with the built file that proves it
// survives bundling, so a pass is never vacuous. Badge and Notice keep
// their render (`client: true`), so their markup ships by design and
// is never a marker. When the Counter markup changes, change its
// marker in the same commit.
const BUILD = path.resolve('example-hydration/build')
const ISOLATION_MARKERS:{ name:string, marker:string, control:string }[] = [
    {
        name: 'stripped Counter markup',
        marker: 'aria-label="Decrement"',
        control: path.join(BUILD, 'server/app.js'),
    },
    {
        name: 'scaffold page marker',
        marker: MARKER,
        control: path.join(BUILD, 'server/app.js'),
    },
    {
        // the build entry is not in the example's server build; its
        // own built file is the control
        name: 'build entry error text',
        marker: 'microtags/build requires "typescript"',
        control: path.resolve('dist/build.js'),
    },
]

function jsAssets (dir:string):string[] {
    return fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter(f => /\.[cm]?js$/.test(f))
        .map(f => path.join(dir, f))
}

const clientAssets = jsAssets(path.join(BUILD, 'client'))
const serverAssets = jsAssets(path.join(BUILD, 'server'))

test('the isolation scan finds client and server assets', t => {
    t.ok(clientAssets.length > 0, 'client build has JS assets')
    t.ok(serverAssets.length > 0, 'server build has JS assets')
})

for (const { name, marker, control } of ISOLATION_MARKERS) {
    test(`${name} stays out of the client build`, t => {
        const rel = path.relative(process.cwd(), control)
        const present = fs.readFileSync(control, 'utf8').includes(marker)
        t.ok(present, present ?
            `${name} is in ${rel}` :
            `${name} marker is stale: not found in ${rel}`)
        if (!present) return
        for (const file of clientAssets) {
            const text = fs.readFileSync(file, 'utf8')
            t.ok(
                !text.includes(marker),
                `${path.relative(BUILD, file)} lacks the ${name}`
            )
        }
    })
}

test('a kept component marker is found in the client build', t => {
    // Badge's render ships, so the scan must find its markup
    const kept = 'class="badge-text"'
    const found = clientAssets.filter(file => {
        return fs.readFileSync(file, 'utf8').includes(kept)
    })
    t.ok(found.length > 0, 'a client asset has the Badge markup')
})
