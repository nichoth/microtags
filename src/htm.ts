import htm from 'htm'
// Registers the server render support module, so `render` statics work.
import './render-support.js'
import type { MicrotagElementClass } from './builders.js'
import type { PropDef } from './types.js'

const _esc:Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
}

function _escHtml (s:string):string {
    return s.replace(/[&"'<>]/g, c => _esc[c])
}

const VOID = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr',
    'img', 'input', 'link', 'meta', 'param',
    'source', 'track', 'wbr',
])

// htm does not know void tags, so an unclosed one takes everything
// after it as children. Fail loudly instead of dropping them.
function _checkVoid (type:unknown, children:unknown[]):void {
    if (typeof type === 'string' && VOID.has(type) && children.length) {
        throw new Error(
            `<${type}> has children: an unclosed void element ` +
            `swallows what follows it. Write it as <${type} />.`
        )
    }
}

// Brands markup across package copies, where `instanceof` fails.
const _M = Symbol.for('microtags.markup')

/**
 * Opaque, trusted output of the templater. Convert it with `String(m)`
 * to get the HTML. Interpolating markup into `html` never escapes it.
 */
export class Markup {
    readonly _v:string
    constructor (v:string) { this._v = v }
    toString ():string { return this._v }
}

// on the prototype, so the brand stays out of the declared type
(Markup.prototype as unknown as Record<symbol, boolean>)[_M] = true

function _isMarkup (v:unknown):v is Markup {
    return v != null && (v as Record<symbol, unknown>)[_M] === true
}

// An interpolated string, escaped for markup. Components receive the
// original text as a prop, so their own serializer escapes it once.
class _Escaped extends Markup {
    readonly _raw:string
    constructor (raw:string) {
        super(_escHtml(raw))
        this._raw = raw
    }
}

export function raw (s:string):Markup {
    return new Markup(s)
}

function _isMicrotag (
    t:unknown
):t is MicrotagElementClass<Record<string, PropDef>> {
    return (
        typeof t === 'function' &&
        'TAG' in t &&
        'render' in t &&
        'props' in t
    )
}

// Comment markers around a reactive region, so the browser can find it.
// Component children open with their own marker, so the browser can
// tell them from regions in the component's own render.
const _OPEN = '<!--[-->'
const _KIDS = '<!--[c-->'
const _CLOSE = '<!--]-->'

// A signal or function in child position is evaluated once. Its result
// did not pass through `html`, so plain strings are escaped here.
function _region (f:() => unknown):string {
    const v = f()
    const out = Array.isArray(v) ?
        _flatten(v.map(_trust)) :
        _flatten([_trust(v)])
    return _OPEN + out + _CLOSE
}

function _trust (v:unknown):unknown {
    return typeof v === 'string' ? _escHtml(v) : v
}

function _flatten (
    children:unknown[]
):string {
    let out = ''
    for (const c of children) {
        if (c == null || c === false) continue
        if (Array.isArray(c)) {
            out += _flatten(c)
        } else if (typeof c === 'function') {
            out += _region(c as () => unknown)
        } else {
            out += String(c)
        }
    }
    return out
}

// Evaluate a signal or function in a prop or attribute hole, and
// unwrap an interpolated string, so attributes are escaped only once.
function _val (v:unknown):unknown {
    const r = typeof v === 'function' ? v() : v
    return r instanceof _Escaped ? r._raw : r
}

// A function-valued on<event> prop is a listener, which the browser
// binds. It has no server output.
function _isListener (k:string, v:unknown):boolean {
    return typeof v === 'function' && k.startsWith('on')
}

// A key that is not a valid attribute name, e.g. from a spread of user
// data, is skipped so it cannot break out of the tag.
const _ATTR = /^[a-z_:][-\w:.]*$/i

export function h (
    type:string | ((...a:unknown[]) => unknown),
    props:Record<string, unknown> | null,
    ...children:unknown[]
):Markup {
    _checkVoid(type, children)
    const inner = _flatten(children)

    if (_isMicrotag(type)) {
        const declared = new Set(
            type.props as readonly string[]
        )
        const compProps:Record<string, unknown> = {}
        const attrs:Record<string, string> = {}

        if (props) {
            for (const [k, pv] of Object.entries(props)) {
                if (_isListener(k, pv)) continue
                const v = _val(pv)
                if (declared.has(k)) {
                    compProps[k] = v
                } else if (!_ATTR.test(k)) {
                    continue
                } else if (v === true) {
                    attrs[k] = ''
                } else if (v !== false && v != null) {
                    attrs[k] = String(v)
                }
            }
        }

        const result = type.render(
            compProps as any,
            {
                children: children.length > 0 ?
                    _KIDS + inner + _CLOSE :
                    inner,
                attrs: Object.keys(attrs).length > 0 ?
                    attrs :
                    undefined,
            }
        )
        return new Markup(String(result))
    }

    if (typeof type === 'string') {
        let a = ''
        if (props) {
            for (const [k, pv] of Object.entries(props)) {
                if (_isListener(k, pv) || !_ATTR.test(k)) continue
                const v = _val(pv)
                if (v === true) {
                    a += ` ${k}`
                } else if (
                    v !== false &&
                    v != null
                ) {
                    a += ` ${k}="${_escHtml(String(v))}"`
                }
            }
        }

        if (VOID.has(type)) {
            return new Markup(`<${type}${a}>`)
        }
        return new Markup(
            `<${type}${a}>${inner}</${type}>`
        )
    }

    return new Markup(inner)
}

const _htm = htm.bind(h)

export function html (
    strings:TemplateStringsArray,
    ...values:unknown[]
):Markup {
    const escaped = values.map(v => {
        if (typeof v === 'string') {
            return new _Escaped(v)
        }
        return v
    })
    const result = (_htm as (...a:unknown[]) => unknown)(
        strings, ...escaped
    )
    if (_isMarkup(result)) return result
    if (Array.isArray(result)) return new Markup(_flatten(result))
    return new Markup(String(result ?? ''))
}
