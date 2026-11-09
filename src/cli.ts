import { transform } from './build.js'
import type TypeScript from 'typescript'

declare const require:(id:string) => unknown
const ts = require('typescript') as typeof TypeScript
import {
    readFileSync,
    writeFileSync,
    mkdirSync,
} from 'node:fs'
import { resolve, relative, dirname, join } from 'node:path'
import { globSync } from 'node:fs'

const USAGE = `Usage: microbuild [globs...] [options]

Options:
  --outdir DIR       Output directory (required in glob mode)
  --root DIR         Root directory for relative paths (default: cwd)
  --cascade          Remove dead imports and declarations
  --keep TAG[,TAG]   Keep render for these tag names (repeatable)
  --help             Show this help
`

function main () {
    const args = process.argv.slice(2)

    let outdir:string | undefined
    let root:string = process.cwd()
    let cascade = false
    const keep:string[] = []
    const globs:string[] = []
    let showHelp = false

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--help') {
            showHelp = true
        } else if (arg === '--outdir') {
            outdir = args[++i]
        } else if (arg === '--root') {
            root = args[++i]
        } else if (arg === '--cascade') {
            cascade = true
        } else if (arg === '--keep') {
            const val = args[++i]
            if (val) {
                for (const t of val.split(',')) {
                    if (t) keep.push(t)
                }
            }
        } else {
            globs.push(arg)
        }
    }

    if (showHelp) {
        process.stdout.write(USAGE)
        process.exit(0)
    }

    if (globs.length === 0) {
        return stdinMode({ cascade, keep })
    }

    if (!outdir) {
        process.stderr.write(
            'Error: --outdir is required in glob mode\n'
        )
        process.exit(1)
    }

    globMode(globs, {
        outdir: resolve(outdir),
        root: resolve(root),
        cascade,
        keep,
    })
}

function stdinMode (
    opts:{ cascade:boolean, keep:string[] }
) {
    let input:string
    try {
        input = readFileSync(0, 'utf-8')
    } catch {
        process.stderr.write('Error: could not read stdin\n')
        process.exit(1)
        return
    }

    let result
    try {
        result = transform(input, {
            cascade: opts.cascade,
            keep: opts.keep,
        })
    } catch (err:any) {
        process.stderr.write(
            'Error: ' + (err?.message ?? 'parse error') +
            '\n'
        )
        process.exit(1)
        return
    }

    if (hasSyntaxErrors(input)) {
        process.stderr.write('Error: parse error\n')
        process.exit(1)
        return
    }

    for (const w of result.warnings) {
        process.stderr.write(
            `warning: ${w.message}` +
            (w.line ? ` (line ${w.line})` : '') +
            '\n'
        )
    }

    process.stdout.write(result.code)
}

interface GlobOpts {
    outdir:string
    root:string
    cascade:boolean
    keep:string[]
}

function globMode (patterns:string[], opts:GlobOpts) {
    const files:string[] = []
    for (const pattern of patterns) {
        for (const f of globSync(pattern)) {
            files.push(resolve(f))
        }
    }

    for (const file of files) {
        const input = readFileSync(file, 'utf-8')
        let result
        try {
            result = transform(input, {
                cascade: opts.cascade,
                keep: opts.keep,
                filename: file,
            })
        } catch {
            process.stderr.write(
                `Error: parse error in ${file}\n`
            )
            process.exit(1)
            return
        }

        for (const w of result.warnings) {
            process.stderr.write(
                `warning: ${w.message}` +
                (w.file ? ` (${w.file}` : '(') +
                (w.line ? `:${w.line})` : ')') +
                '\n'
            )
        }

        const rel = relative(opts.root, file)
        const outPath = join(opts.outdir, rel)
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, result.code)
    }
}

function hasSyntaxErrors (code:string):boolean {
    const sf = ts.createSourceFile(
        'input.ts', code, ts.ScriptTarget.Latest, true
    )
    const diags = (sf as any).parseDiagnostics
    return Array.isArray(diags) && diags.length > 0
}

main()
