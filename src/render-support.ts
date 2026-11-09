// Server render support: the host-tag builder, prop serializers and
// attribute escaping. Importing this module registers `renderHost`
// under a registry symbol on `globalThis`, where a component's `render`
// static finds it. Core never imports this module, so a bundle with
// every render link stripped leaves it out. See ADR-009.
import type {
    PropMeta,
    RenderParts,
    RenderRecord,
} from './builders.js'

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

// HTML attribute name grammar: a letter, `_` or `:`, then letters,
// digits, `-`, `_`, `:` or `.`. Extra attrs may come from data.
const _attrName = /^[a-z_:][-\w:.]*$/i

// The kind is decided by core, so no coercer is compared here and any
// copy of this module serves any copy of core.
function _serialize (m:PropMeta, v:unknown):string | null {
    if (m.kind === 'prop-only' || v == null) return null
    if (m.kind === 'boolean') return v === true ? '' : null
    if (m.kind === 'json') return JSON.stringify(v)
    return String(v)
}

function _attr (k:string, v:string):string {
    return v === '' ? ` ${k}` : ` ${k}="${_escAttr(v)}"`
}

/**
 * Render a component as parts: the host tag name, its serialized
 * (unescaped) attributes, declared props first, and the inner HTML.
 * `attrs` has no prototype, so a name like `__proto__` from data is a
 * plain key. A declared prop keeps its value over an extra attr of the
 * same name, as an HTML parser keeps the first of a duplicate.
 */
export function renderParts (
    rec:RenderRecord,
    props:Record<string, unknown>,
    options?:{ children?:string; attrs?:Record<string, string> }
):RenderParts {
    const extra = options?.attrs ?? {}
    const html = String(rec.f({
        props,
        refs: rec.r,
        TAG: rec.t,
        children: options?.children ?? '',
        attrs: extra,
    }))
    const attrs:Record<string, string> = Object.create(null)
    for (const k in rec.m) {
        const s = k in props ? _serialize(rec.m[k], props[k]) : null
        if (s !== null) attrs[k] = s
    }
    for (const [k, v] of Object.entries(extra)) {
        if (_attrName.test(k)) attrs[k] ??= v
    }
    return { tag: rec.t, attrs, html }
}

/** Render a component's host tag around the output of its render link. */
export function renderHost (
    rec:RenderRecord,
    props:Record<string, unknown>,
    options?:{ children?:string; attrs?:Record<string, string> }
):string {
    const { tag, attrs, html } = renderParts(rec, props, options)
    let a = ''
    for (const k in attrs) a += _attr(k, attrs[k])
    return `<${tag}${a}>${html}</${tag}>`
}

/**
 * Store `renderHost` and `renderParts` where the `render` and
 * `renderParts` statics look them up.
 */
export function register ():void {
    const g = globalThis as any
    g[Symbol.for('microtags.render')] = renderHost
    g[Symbol.for('microtags.renderParts')] = renderParts
}

register()
