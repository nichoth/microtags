import type { Plugin, OnLoadArgs, OnLoadResult } from 'esbuild'
import { readFileSync } from 'fs'
import { transform } from './build.js'
import type { TransformOptions } from './build.js'

export interface MicrotagsEsbuildOptions
    extends TransformOptions {
    filter?:RegExp
}

export function microtags (
    options?:MicrotagsEsbuildOptions
):Plugin {
    const filter = options?.filter ?? /\.(ts|js|mjs)$/
    const cascade = options?.cascade
    const keep = options?.keep as string[] | undefined

    return {
        name: 'microtags',
        setup (build) {
            build.onLoad({ filter }, (args:OnLoadArgs) => {
                const code = readFileSync(
                    args.path, 'utf8'
                )
                const result = transform(code, {
                    cascade,
                    keep,
                    filename: args.path,
                })

                const warnings = result.warnings.map(w => ({
                    text: w.message,
                    location: {
                        file: args.path,
                        line: w.line,
                    },
                }))

                return {
                    contents: result.code,
                    loader: args.path.endsWith('.ts') ?
                        'ts' :
                        'js',
                    warnings,
                } as OnLoadResult
            })
        },
    }
}
