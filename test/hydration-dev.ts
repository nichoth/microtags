import { test } from '@substrate-system/tapzero'
import { createServer, type ViteDevServer } from 'vite'
import * as path from 'path'

// Drives the hydration example's Vite dev server (Hono inside Vite)
// over HTTP. See `npm run test:hydration-dev`.

const MARKER = '<!--microtags:main-->'
let server:ViteDevServer
let base:string

function hostHasChildren (page:string, tag:string):boolean {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)
    const inner = page.match(re)?.[1] ?? ''
    return /<[a-z]/i.test(inner)
}

function count (haystack:string, needle:string):number {
    return haystack.split(needle).length - 1
}

test('start the dev server', async t => {
    server = await createServer({
        configFile: path.resolve('example-hydration/vite.config.ts'),
        logLevel: 'silent',
        server: { port: 0, open: false, host: '127.0.0.1' },
    })
    await server.listen()
    base = server.resolvedUrls!.local[0].replace(/\/$/, '')
    t.ok(base, 'server is listening')
})

test('dev index is the assembled page with one vite client', async t => {
    const res = await fetch(base + '/example-hydration/')
    const page = await res.text()

    t.equal(res.status, 200, 'status is 200')
    t.ok(
        (res.headers.get('content-type') ?? '').startsWith('text/html'),
        'content type is text/html'
    )
    t.ok(!page.includes(MARKER), 'marker is replaced')
    t.equal(count(page, '/@vite/client'), 1, 'vite client inserted once')
    t.ok(hostHasChildren(page, 'hydra-counter'),
        'server-side counter render ran')
    t.ok(hostHasChildren(page, 'hydra-badge'),
        'server-side badge render ran')
})

test('dev sub-routes are assembled with one vite client', async t => {
    for (const route of ['list', 'notice']) {
        const res = await fetch(base + '/example-hydration/' + route)
        const page = await res.text()
        t.equal(res.status, 200, `${route} status is 200`)
        t.ok(!page.includes(MARKER), `${route} marker is replaced`)
        t.equal(count(page, '/@vite/client'), 1,
            `${route} vite client inserted once`)
    }
})

test('the raw scaffold is never served', async t => {
    const res = await fetch(base + '/example-hydration/index.html')
    const page = await res.text()
    t.ok(!page.includes(MARKER), 'index.html does not return the marker')
})

test('the browser module has the counter render stripped', async t => {
    const res = await fetch(
        base + '/example-hydration/components/counter.ts'
    )
    const code = await res.text()
    t.equal(res.status, 200, 'module is served')
    t.ok(!code.includes('.render('), 'render link is stripped')
})

test('stop the dev server', async t => {
    await server.close()
    t.ok(true, 'closed')
})
