import type { Plugin } from 'vite'
import { transform } from './build.js'
import type { TransformOptions } from './build.js'

export interface MicrotagsViteOptions
    extends TransformOptions {
    filter?:RegExp
}

export function microtags (
    options?:MicrotagsViteOptions
):Plugin {
    const filter = options?.filter ?? /\.(ts|js|mjs)$/
    const cascade = options?.cascade
    const keep = options?.keep as string[] | undefined

    return {
        name: 'microtags',
        transform (
            code:string,
            id:string,
            opts?:{ ssr?:boolean }
        ) {
            if (!filter.test(id)) return null
            // Server modules must keep their render links. Key on the
            // environment consumer, not build vs dev mode; older Vite
            // hook signatures only pass `options.ssr`.
            const consumer = this.environment?.config.consumer
            if (consumer ? consumer === 'server' : opts?.ssr) {
                return null
            }

            const result = transform(code, {
                cascade,
                keep,
                filename: id,
            })

            for (const w of result.warnings) {
                this.warn({
                    message: w.message,
                    id,
                    pos: undefined,
                })
            }

            return {
                code: result.code,
                map: null,
            }
        },
    }
}
