/**
 * Inject the current bundle size (as measured by `size-limit`) into
 * README.md, between the `<!-- size -->` and `<!-- /size -->` markers.
 * Measures whatever is in `dist`, so build before running.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const START = '<!-- size -->'
const END = '<!-- /size -->'

const json = execSync('size-limit --json', { encoding: 'utf8' })
const results:Array<{ name:string, size:number }> = JSON.parse(json)
const entry = results.find(r => r.name === 'microtags') ?? results[0]

if (!entry) {
    throw new Error('size-limit returned no results')
}

// size-limit reports kB as bytes / 1000; match its number.
const value = `${(entry.size / 1000).toFixed(2)} KB`

const readme = readFileSync('README.md', 'utf8')
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`)

if (!pattern.test(readme)) {
    throw new Error(
        `README.md is missing the "${START} ... ${END}" markers`
    )
}

writeFileSync('README.md', readme.replace(pattern, `${START}${value}${END}`))
process.stdout.write(`Injected bundle size ${value} into README.md\n`)
