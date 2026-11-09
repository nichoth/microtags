import { test } from '@substrate-system/tapzero'
import * as esbuild from 'esbuild'
import { build as viteBuild } from 'vite'
import * as path from 'path'
import * as fs from 'fs'
const fixturesDir = path.resolve('test/fixtures')

import { microtags as esbuildPlugin } from '../src/esbuild.js'
import { microtags as vitePlugin } from '../src/vite.js'

async function bundleWithEsbuild (
    fixture:string,
    pluginOpts?:Record<string, unknown>
):Promise<string> {
    const result = await esbuild.build({
        entryPoints: [path.join(fixturesDir, fixture)],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
        plugins: [esbuildPlugin(pluginOpts)],
        external: ['microtags'],
    })
    return result.outputFiles[0].text
}

async function bundleWithVite (
    fixture:string,
    pluginOpts?:Record<string, unknown>,
    ssr = false
):Promise<string> {
    const input = path.join(fixturesDir, fixture)
    const outDir = path.resolve(
        '.tmp-vite-' + Date.now()
    )
    await viteBuild({
        root: fixturesDir,
        logLevel: 'silent',
        build: {
            lib: {
                entry: input,
                formats: ['es'],
                fileName: 'out',
            },
            outDir,
            ssr,
            rollupOptions: {
                external: ['microtags'],
            },
            minify: false,
            write: true,
        },
        plugins: [vitePlugin(pluginOpts)],
    })

    // SSR builds name the output after the entry, not `fileName`
    const [outName] = fs.readdirSync(outDir)
        .filter(f => f.endsWith('.js'))
    const outFile = path.join(outDir, outName)
    const code = fs.readFileSync(outFile, 'utf8')
    fs.rmSync(outDir, { recursive: true, force: true })
    return code
}

// -- esbuild tests --

test('esbuild: strips .render() from bundle', async t => {
    const code = await bundleWithEsbuild('strip-render.ts')
    t.ok(
        !code.includes('.render('),
        'no .render() call in esbuild output'
    )
})

test('esbuild: keeps .render() with client:true', async t => {
    const code = await bundleWithEsbuild('keep-render.ts')
    t.ok(
        code.includes('.render('),
        '.render() preserved in esbuild output'
    )
})

test('esbuild: file not matching filter is untransformed',
    async t => {
        const result = await esbuild.build({
            entryPoints: [
                path.join(fixturesDir, 'strip-render.ts'),
            ],
            bundle: true,
            write: false,
            format: 'esm',
            platform: 'node',
            plugins: [esbuildPlugin({ filter: /\.xyz$/ })],
            external: ['microtags'],
        })
        const code = result.outputFiles[0].text
        t.ok(
            code.includes('.render('),
            '.render() still present when filter excludes file'
        )
    }
)

test('esbuild: warnings surface through bundler', async t => {
    const _warnings:esbuild.Message[] = []
    const result = await esbuild.build({
        entryPoints: [
            path.join(fixturesDir, 'warn-render.ts'),
        ],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
        plugins: [esbuildPlugin()],
        external: ['microtags'],
        logLevel: 'silent',
    })
    const w = result.warnings
    t.ok(
        w.length > 0,
        'esbuild receives warnings from transform'
    )
})

// Resolve the package to source so the metafile names source modules
const fromSource:esbuild.Plugin = {
    name: 'microtags-source',
    setup (build) {
        build.onResolve({ filter: /^microtags(\/render-support)?$/ }, a => ({
            path: path.resolve(a.path === 'microtags' ?
                'src/index.ts' :
                'src/render-support.ts'),
        }))
    },
}

async function bundleInputs (fixture:string):Promise<string[]> {
    const result = await esbuild.build({
        entryPoints: [path.join(fixturesDir, fixture)],
        bundle: true,
        write: false,
        metafile: true,
        format: 'esm',
        platform: 'browser',
        plugins: [fromSource, esbuildPlugin()],
    })
    return Object.keys(result.metafile.inputs)
}

const isSupport = (input:string) => /render-support\.ts$/.test(input)

test('esbuild: all-stripped bundle has no render support', async t => {
    const inputs = await bundleInputs('support-stripped.ts')
    t.ok(inputs.some(i => /builders\.ts$/.test(i)), 'core is bundled')
    t.ok(!inputs.some(isSupport), 'render support is not an input')
})

test('esbuild: kept-render bundle has render support', async t => {
    const inputs = await bundleInputs('support-kept.ts')
    t.ok(inputs.some(isSupport), 'render support is an input')
})

// -- vite tests --

test('vite: strips .render() from bundle', async t => {
    const code = await bundleWithVite('strip-render.ts')
    t.ok(
        !code.includes('.render('),
        'no .render() call in vite output'
    )
})

test('vite: server build keeps .render(), client strips',
    async t => {
        const server = await bundleWithVite(
            'strip-render.ts',
            undefined,
            true
        )
        t.ok(
            server.includes('.render('),
            '.render() preserved in vite server build'
        )
        const client = await bundleWithVite('strip-render.ts')
        t.ok(
            !client.includes('.render('),
            '.render() removed in vite client build'
        )
    })

test('vite: keeps .render() with client:true', async t => {
    const code = await bundleWithVite('keep-render.ts')
    t.ok(
        code.includes('.render('),
        '.render() preserved in vite output'
    )
})

test('vite: file not matching filter is untransformed',
    async t => {
        const input = path.join(fixturesDir, 'strip-render.ts')
        const outDir = path.resolve(
            '.tmp-vite-filter-' + Date.now()
        )
        await viteBuild({
            root: fixturesDir,
            logLevel: 'silent',
            build: {
                lib: {
                    entry: input,
                    formats: ['es'],
                    fileName: 'out',
                },
                outDir,
                rollupOptions: {
                    external: ['microtags'],
                },
                minify: false,
                write: true,
            },
            plugins: [vitePlugin({ filter: /\.xyz$/ })],
        })
        const outFile = path.join(outDir, 'out.js')
        const code = fs.readFileSync(outFile, 'utf8')
        fs.rmSync(outDir, { recursive: true, force: true })
        t.ok(
            code.includes('.render('),
            '.render() still present when vite filter excludes'
        )
    }
)

test('vite: warnings surface through bundler', async t => {
    const input = path.join(fixturesDir, 'warn-render.ts')
    const outDir = path.resolve(
        '.tmp-vite-warn-' + Date.now()
    )

    let warningCount = 0
    await viteBuild({
        root: fixturesDir,
        logLevel: 'silent',
        build: {
            lib: {
                entry: input,
                formats: ['es'],
                fileName: 'out',
            },
            outDir,
            rollupOptions: {
                external: ['microtags'],
                onwarn (_warning) {
                    warningCount++
                },
            },
            minify: false,
            write: true,
        },
        plugins: [vitePlugin()],
    })
    fs.rmSync(outDir, { recursive: true, force: true })
    t.ok(warningCount > 0, 'vite receives warnings from transform')
})

async function bundleHtm (platform:'browser'|'node'):Promise<string> {
    const result = await esbuild.build({
        stdin: {
            contents: "import * as m from 'microtags/htm'\n" +
                'console.log(m)',
            resolveDir: path.resolve('.'),
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform,
    })
    return result.outputFiles[0].text
}

test('microtags/htm resolves per platform via export conditions', async t => {
    const browser = await bundleHtm('browser')
    const node = await bundleHtm('node')
    t.ok(browser.includes('htm.browser.js'), 'browser gets browser module')
    t.ok(!node.includes('htm.browser.js'), 'node does not')
    t.ok(node.includes('dist/htm.js'), 'node gets the server module')
})
