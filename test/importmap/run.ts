/// <reference types="node" />
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { chromium } from 'playwright'

/**
 * Standalone runner for the import-map test. The existing tapout pipeline
 * bundles with esbuild, which resolves imports at build time and so cannot
 * exercise the browser's import-map mechanism. This serves the repo over
 * HTTP and loads a real page whose bare-specifier imports are resolved by
 * an <script type="importmap"> against the built dist.
 */

type Result = { name:string; ok:boolean }

const ROOT = process.cwd()
const PAGE = '/test/importmap/index.html'
const TIMEOUT = 15_000

const MIME:Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
}

function startServer ():Promise<{ server:Server; port:number }> {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? '/', 'http://localhost')
            // Strip the query/hash, decode, and block path traversal.
            const rel = normalize(decodeURIComponent(url.pathname))
                .replace(/^(\.\.[/\\])+/, '')
            const filePath = join(ROOT, rel)
            if (!filePath.startsWith(ROOT)) {
                res.writeHead(403).end('forbidden')
                return
            }
            const body = await readFile(filePath)
            res.writeHead(200, {
                'content-type': MIME[extname(filePath)] ??
                    'application/octet-stream',
            }).end(body)
        } catch {
            res.writeHead(404).end('not found')
        }
    })

    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address()
            const port = typeof addr === 'object' && addr ? addr.port : 0
            resolve({ server, port })
        })
    })
}

async function main ():Promise<number> {
    const { server, port } = await startServer()
    const browser = await chromium.launch()
    const pageErrors:string[] = []

    try {
        const page = await browser.newPage()
        page.on('pageerror', err => pageErrors.push(err.message))
        page.on('console', msg => {
            if (msg.type() === 'error') pageErrors.push(msg.text())
        })

        await page.goto(`http://127.0.0.1:${port}${PAGE}`)

        try {
            await page.waitForFunction(
                () => (window as any).testsFinished === true,
                undefined,
                { timeout: TIMEOUT }
            )
        } catch {
            console.error('# import-map test did not finish in time')
            for (const e of pageErrors) console.error('# ' + e)
            return 1
        }

        const results:Result[] = await page.evaluate(
            () => (window as any).__IMPORTMAP_RESULTS__ ?? []
        )

        console.log('TAP version 13')
        console.log(`1..${results.length}`)
        let pass = 0
        results.forEach((r, i) => {
            console.log(`${r.ok ? 'ok' : 'not ok'} ${i + 1} - ${r.name}`)
            if (r.ok) pass++
        })
        console.log(`# tests ${results.length}`)
        console.log(`# pass ${pass}`)
        console.log(`# fail ${results.length - pass}`)

        const failed = results.length === 0 || pass !== results.length
        if (failed) {
            for (const e of pageErrors) console.error('# ' + e)
        }
        return failed ? 1 : 0
    } finally {
        await browser.close()
        await new Promise<void>(resolve => server.close(() => resolve()))
    }
}

main().then(code => process.exit(code)).catch(err => {
    console.error(err)
    process.exit(1)
})
