import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, PREFIX } from './app.js'

// Print the assembled page for a route to stdout.
// Usage: npm run ssr:hydration -- [route]   (default `/`)

const route = process.argv[2] ?? '/'
const scaffoldPath = resolve('example-hydration/index.html')
const app = createApp({
    loadScaffold: () => readFileSync(scaffoldPath, 'utf8'),
})

async function main ():Promise<void> {
    const path = PREFIX + (route.startsWith('/') ? route : '/' + route)
    const res = await app.request(path)
    process.stdout.write(await res.text())
    if (!res.ok) process.exitCode = 1
}

main()
