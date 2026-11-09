import type { RenderRecord } from './builders.js'

type Impl = (
    rec:RenderRecord,
    props:any,
    options?:{ children?:string; attrs?:Record<string, string> }
) => string

let _impl:Impl | undefined

export function _setRender (f:Impl):void {
    _impl = f
}

export function _render (...args:Parameters<Impl>):string {
    if (!_impl) {
        throw new Error(
            'microtags: render needs the server render support module. ' +
            'Import "microtags/render-support" or a templater.'
        )
    }
    return _impl(...args)
}
