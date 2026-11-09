// Prototype of the server render support module: the host-tag builder,
// prop serializers and attribute escaping moved out of builders.ts.
import type { RenderRecord, PropMeta } from './builders.js'

const _esc:Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
}
function _escAttr (s:string):string {
    return s.replace(/[&"'<>]/g, c => _esc[c])
}

function _serialize (m:PropMeta, v:unknown):string | null {
    if (m.kind === 'prop-only' || v == null) return null
    if (m.kind === 'schema') return String(v)
    if (m.kind === 'boolean') return v === true ? '' : null
    if (m.kind === 'json') return JSON.stringify(v)
    return String(v)
}

function _attr (k:string, v:string):string {
    return v === '' ? ` ${k}` : ` ${k}="${_escAttr(v)}"`
}

export function renderStatic (
    rec:RenderRecord,
    props:Record<string, unknown>,
    options?:{ children?:string; attrs?:Record<string, string> }
):string {
    const attrs = options?.attrs ?? {}
    const inner = rec.f({
        props,
        refs: rec.r,
        TAG: rec.t,
        children: options?.children ?? '',
        attrs,
    })
    let a = ''
    for (const [k, m] of Object.entries(rec.m)) {
        if (!(k in props)) continue
        const s = _serialize(m, props[k])
        if (s !== null) a += _attr(k, s)
    }
    for (const [k, v] of Object.entries(attrs)) a += _attr(k, v)
    return `<${rec.t}${a}>${String(inner)}</${rec.t}>`
}
