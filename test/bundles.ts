// Reads the built `dist/` (run `npm run build` first) and proves the
// adapter split holds: the browser adapter carries no render support
// and no `preact-render-to-string`, and no entry but the adapter
// imports `preact`. Markers are fixed strings, never regexes. Each one
// is first proven present in its control file, so a marker that
// bundling renamed or dropped fails as stale instead of passing.
import { test } from '@substrate-system/tapzero'
import * as fs from 'fs'
import * as path from 'path'

const DIST = path.resolve('dist')

// `build-esm` uses `--splitting`, so an entry's code may live in shared
// chunks. Follow relative import specifiers transitively.
const REL_IMPORT = /(?:from|import)\s*["'](\.\.?\/[^"']+)["']/g

function withChunks (entry:string):string[] {
    const seen = new Set<string>()
    const queue = [path.join(DIST, entry)]
    while (queue.length) {
        const file = queue.pop()!
        if (seen.has(file)) continue
        seen.add(file)
        const text = fs.readFileSync(file, 'utf8')
        for (const m of text.matchAll(REL_IMPORT)) {
            queue.push(path.resolve(path.dirname(file), m[1]))
        }
    }
    return [...seen]
}

const rel = (f:string) => path.relative(process.cwd(), f)

interface Marker {
    name:string;
    marker:string;
    // files whose union must contain the marker
    control:string[];
    // files that must each lack it
    checked:string[];
}

const BROWSER_ADAPTER = [
    ...withChunks('preact.browser.js'),
    ...withChunks('preact.browser.min.js'),
]

const NON_ADAPTER_ENTRIES = [
    'index.js',
    'index.min.js',
    'render.js',
    'context.js',
    'util.js',
    'htm.js',
    'htm.browser.js',
    'render-support.js',
    'build.js',
    'esbuild.js',
    'vite.js',
]

const MARKERS:Marker[] = [
    {
        // an entry of the attribute escaper's table; core holds the
        // `microtags.render*` symbol keys too, so those are not markers
        name: 'render support escaper',
        marker: '&#39;',
        control: withChunks('render-support.js'),
        checked: BROWSER_ADAPTER,
    },
    {
        // the default adapter build does not import it (the caller
        // renders), so the package's own manifest is the control that
        // proves the specifier's spelling
        name: 'preact-render-to-string specifier',
        marker: '"preact-render-to-string"',
        control: [
            path.resolve('node_modules/preact-render-to-string/package.json')
        ],
        checked: BROWSER_ADAPTER,
    },
    {
        name: 'bare preact import',
        marker: '"preact"',
        control: withChunks('preact.js'),
        checked: [...new Set(NON_ADAPTER_ENTRIES.flatMap(withChunks))],
    },
]

test('the bundle scan follows chunks', t => {
    const files = withChunks('preact.browser.js')
    t.ok(files.length > 1, 'the browser adapter imports at least one chunk')
})

for (const { name, marker, control, checked } of MARKERS) {
    test(`${name} stays out of the files that must lack it`, t => {
        const where = control.find(f => {
            return fs.readFileSync(f, 'utf8').includes(marker)
        })
        t.ok(where, where ?
            `${name} is in ${rel(where)}` :
            `${name} marker is stale: not found in ` +
                control.map(rel).join(', '))
        if (!where) return
        for (const file of checked) {
            const text = fs.readFileSync(file, 'utf8')
            t.ok(!text.includes(marker), `${rel(file)} lacks the ${name}`)
        }
    })
}
