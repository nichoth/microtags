import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'

// Production listener. Runs from `build/server/listen.js` and serves the
// client build next to it. The only module that binds a port.

const clientDir = resolve(import.meta.dirname!, '../client')
const scaffoldPath = resolve(clientDir, 'example-hydration/index.html')

let scaffold:string
try {
    // loaded once; the built scaffold already has final asset URLs
    scaffold = readFileSync(scaffoldPath, 'utf8')
} catch {
    console.error(`missing built scaffold at ${scaffoldPath}; ` +
        'run `npm run build:hydration` first')
    process.exit(1)
}

const app = createApp({ loadScaffold: () => scaffold })
// registered after the page routes, so the scaffold is never served
// unassembled; misses fall through to the app's not-found page
app.use('*', serveStatic({ root: clientDir }))

const port = Number(process.env.PORT ?? 8888)
serve({ fetch: app.fetch, port }, info => {
    console.log(`listening on http://localhost:${info.port}/example-hydration/`)
})
