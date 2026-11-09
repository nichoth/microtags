import { defineConfig, type ViteDevServer } from 'vite'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import devServer from '@hono/vite-dev-server'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { microtags } from '../dist/vite.js'
import type * as AppModule from './server/app.js'
import type * as ScaffoldModule from './server/scaffold.js'

const root = resolve(import.meta.dirname!, '..')
const PREFIX = '/example-hydration'
const scaffoldPath = resolve(import.meta.dirname!, 'index.html')
const buildDir = resolve(import.meta.dirname!, 'build')

// Vite config for the hydration example. The Hono app handles every
// page route under the prefix; everything else falls through to Vite.
// `vite build` writes the client build of the scaffold to `build/client`;
// `vite build --ssr` writes the listener and app to `build/server`.
export default defineConfig(({ isSsrBuild }) => ({
    root,
    publicDir: false,
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            targets: browserslistToTargets(browserslist('>= 0.25%')),
        },
    },
    build: isSsrBuild ?
        {
            outDir: resolve(buildDir, 'server'),
            emptyOutDir: true,
            rolldownOptions: {
                input: {
                    listen: resolve(import.meta.dirname!, 'server/listen.ts'),
                    app: resolve(import.meta.dirname!, 'server/app.ts'),
                },
            },
        } :
        {
            outDir: resolve(buildDir, 'client'),
            emptyOutDir: true,
            rolldownOptions: { input: scaffoldPath },
        },
    server: {
        port: 8888,
        host: true,
    },
    resolve: {
        alias: [
            {
                find: /^microtags$/,
                replacement: resolve(root, 'src/index.ts'),
            },
            {
                // injected by the stripping plugin for kept render links
                find: /^microtags\/render-support$/,
                replacement: resolve(root, 'src/render-support.ts'),
            },
        ],
    },
    plugins: [
        // same split as the `browser` export condition on `./htm`
        {
            name: 'microtags-htm-source',
            enforce: 'pre',
            resolveId (id, _importer, opts) {
                if (id !== 'microtags/htm') return null
                return resolve(root, opts?.ssr ?
                    'src/htm.ts' :
                    'src/htm.browser.ts')
            },
        },
        microtags({
            filter: /example-hydration\/(client|components)\/.*\.(ts|js|mjs)$/,
            cascade: true,
        }),
        devServer({
            entry: resolve(import.meta.dirname!, 'server/app.ts'),
            // the HTML transform inserts the Vite client, not this plugin
            injectClientScript: false,
            exclude: [
                // only paths under the prefix reach the app
                new RegExp(`^(?!${PREFIX}(/|$|\\?))`),
                /.*\.(css|ts|tsx|js|mjs|jsx)(\?.*)?$/,
                /^\/@.+$/,
                /\?t=\d+$/,
            ],
            loadModule: loadApp,
        }),
    ],
}))

async function loadApp (server:ViteDevServer, entry:string) {
    const { createApp } = await server.ssrLoadModule(entry) as
        typeof AppModule
    const { devLoader } = await server.ssrLoadModule(
        resolve(import.meta.dirname!, 'server/scaffold.ts')
    ) as typeof ScaffoldModule
    const app = createApp({
        loadScaffold: devLoader(
            () => readFile(scaffoldPath, 'utf8'),
            (url, html) => server.transformIndexHtml(url, html),
            PREFIX + '/index.html'
        ),
    })
    // the app reads no bindings, so only the request is forwarded
    return { fetch: async (req:Request) => app.fetch(req) }
}
