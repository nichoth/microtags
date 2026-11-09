import { test } from '@substrate-system/tapzero'
import { spawn, spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Tests for the production listener in the hydration example. They run
// the built listener as a subprocess, so `npm run build:hydration` must
// run first. See `npm run test:hydration`.

const BUILD = path.resolve('example-hydration/build')
const LISTEN = path.join(BUILD, 'server/listen.js')
const MARKER = '<!--microtags:main-->'

test('the build writes both client and server outputs', async t => {
    t.ok(
        fs.existsSync(path.join(BUILD, 'client/example-hydration/index.html')),
        'client build has the scaffold'
    )
    t.ok(fs.existsSync(LISTEN), 'server build has the listener')
})

test('the listener serves every route assembled with built assets', async t => {
    const child = spawn(process.execPath, [LISTEN], {
        env: { ...process.env, PORT: '0' },
        stdio: ['ignore', 'pipe', 'inherit'],
    })

    try {
        const base = await new Promise<string>((resolve, reject) => {
            let out = ''
            child.stdout!.on('data', (d:Buffer) => {
                out += d
                const m = out.match(/http:\/\/localhost:\d+/)
                if (m) resolve(m[0])
            })
            child.on('exit', code => reject(new Error(`exited ${code}`)))
        })

        const routes = ['/', '/index.html', '/list', '/notice']
        for (const route of routes) {
            const res = await fetch(base + '/example-hydration' + route)
            const page = await res.text()
            t.equal(res.status, 200, `${route} is 200`)
            t.ok(!page.includes(MARKER), `${route} has the marker replaced`)
            t.ok(!/\.ts"/.test(page), `${route} references no source .ts`)
        }

        const page = await (await fetch(base + '/example-hydration/')).text()
        const src = page.match(/<script\b[^>]*\bsrc="([^"]+)"/)?.[1] ?? ''
        t.ok(src, 'page has a module script')
        const asset = await fetch(new URL(src, base + '/example-hydration/'))
        t.equal(asset.status, 200, 'the built client script is served')
    } finally {
        child.kill()
    }
})

test('the listener exits with an error when the scaffold is missing', t => {
    // copy the server build alone, so the client build is absent
    // inside the repo, so the copy still resolves node_modules
    const tmp = fs.mkdtempSync(path.join(BUILD, 'missing-'))
    fs.cpSync(path.join(BUILD, 'server'), path.join(tmp, 'server'), {
        recursive: true,
    })
    const res = spawnSync(
        process.execPath,
        [path.join(tmp, 'server/listen.js')],
        { env: { ...process.env, PORT: '0' }, timeout: 10000 }
    )
    fs.rmSync(tmp, { recursive: true, force: true })

    t.ok(res.status !== null && res.status !== 0, 'exits with non-zero code')
})
