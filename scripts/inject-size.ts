/**
 * Inject bundle sizes (as measured by size-limit) into README.md.
 * Measures whatever is in dist, so build before running.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const MARKERS:[string, string, string][] = [
    ['microtags', '<!-- size -->', '<!-- /size -->'],
    ['microtags/htm', '<!-- size:htm -->', '<!-- /size:htm -->'],
    [
        'microtags/preact (browser)',
        '<!-- size:preact -->',
        '<!-- /size:preact -->',
    ],
]

const json = execSync('size-limit --json', { encoding: 'utf8' })
const results:Array<{ name:string; size:number }> = JSON.parse(json)

let readme = readFileSync('README.md', 'utf8')

for (const [name, start, end] of MARKERS) {
    const entry = results.find(r => r.name === name)
    if (!entry) {
        throw new Error(
            `size-limit returned no result for "${name}"`
        )
    }

    const pattern = new RegExp(
        `${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}`
    )

    if (!pattern.test(readme)) {
        throw new Error(
            'README.md is missing the '
            + `"${start} ... ${end}" markers`
        )
    }

    const value = `${(entry.size / 1000).toFixed(2)} KB`
    readme = readme.replace(
        pattern,
        `${start}${value}${end}`
    )
    process.stdout.write(
        `Injected ${name} size ${value} into README.md\n`
    )
}

writeFileSync('README.md', readme)

function escapeRe (s:string):string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
