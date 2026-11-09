import type { RenderRecord } from './builders.js'

type Impl = (
    rec:RenderRecord,
    props:any,
    options?:{ children?:string; attrs?:Record<string, string> }
) => string

export function _render (...args:Parameters<Impl>):string {
    const f = (globalThis as any)[Symbol.for('microtags.render')] as
        Impl | undefined
    if (!f) {
        throw new Error(
            'microtags: render needs the server render support module. ' +
            'Import "microtags/render-support" or a templater.'
        )
    }
    return f(...args)
}
