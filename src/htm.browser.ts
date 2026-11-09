import htm from 'htm'
import { effect, effectScope, untracked } from './reactivity.js'
import type { MicrotagElementClass } from './builders.js'
import { register } from './render-support.js'
import type { PropDef } from './types.js'

// Browser build of `microtags/htm`, selected by the `browser` export
// condition. `html` describes nodes instead of building a string, and
// `mount` turns that description into DOM with live bindings.

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

type Comp = MicrotagElementClass<Record<string, PropDef>>
type VType = string | Comp | ((...a:unknown[]) => unknown)

interface VNode {
    t:VType
    p:Record<string, unknown> | null
    c:unknown[]
}

// Brands markup across package copies, where `instanceof` fails.
const _M = Symbol.for('microtags.markup')

/**
 * Opaque, trusted output of the templater. In the browser it describes
 * nodes for `mount`; `String(m)` still yields static HTML.
 */
export class Markup {
    // a node description, or trusted HTML from `raw`
    readonly _n:VNode | unknown[] | null
    readonly _h:string | null
    constructor (n:VNode | unknown[] | null, h:string | null = null) {
        this._n = n
        this._h = h
    }

    toString ():string {
        return this._h ?? _str(this._n)
    }
}

// on the prototype, so the brand stays out of the declared type
(Markup.prototype as unknown as Record<symbol, boolean>)[_M] = true

export function raw (s:string):Markup {
    return new Markup(null, s)
}

function _isMarkup (c:unknown):c is Markup {
    return c != null && (c as Record<symbol, unknown>)[_M] === true
}

function _isMicrotag (t:unknown):t is Comp {
    return typeof t === 'function' && 'TAG' in t && 'props' in t
}

function _isEvent (k:string, v:unknown):boolean {
    return k.startsWith('on') && typeof v === 'function'
}

// A key that is not a valid attribute name, e.g. from a spread of user
// data, is skipped so it cannot break out of a tag or make
// `setAttribute` throw.
const _ATTR = /^[a-z_:][-\w:.]*$/i

function _read (v:unknown):unknown {
    return typeof v === 'function' ? untracked(v as () => unknown) : v
}

function _renderLink (type:Comp):Comp['render'] {
    if (typeof type.render !== 'function') {
        throw new Error(
            `microtags: cannot create <${type.TAG}> in the browser: its ` +
            'render link was stripped. Keep it with ' +
            '`.render(fn, { client: true })` or the build-time keep list.'
        )
    }
    return type.render
}

// Split a component's props into declared props and extra attributes.
// Signals and functions are read once.
function _compArgs (type:Comp, props:Record<string, unknown> | null) {
    const declared = new Set(type.props as readonly string[])
    const compProps:Record<string, unknown> = {}
    const attrs:Record<string, string> = {}
    for (const [k, v] of Object.entries(props ?? {})) {
        if (declared.has(k)) {
            compProps[k] = _read(v)
        } else if (!_isEvent(k, v) && _ATTR.test(k)) {
            const r = _read(v)
            if (r === true) attrs[k] = ''
            else if (r !== false && r != null) attrs[k] = String(r)
        }
    }
    return { compProps, attrs }
}

function _str (c:unknown):string {
    if (c == null || c === false) return ''
    if (Array.isArray(c)) return c.map(_str).join('')
    if (_isMarkup(c)) return String(c)
    if (typeof c === 'function') return _str(_read(c))
    if (typeof c !== 'object' || !('t' in c)) {
        return _escHtml(String(c))
    }
    const { t, p, c: kids } = c as VNode
    const inner = _str(kids)
    if (_isMicrotag(t)) {
        const { compProps, attrs } = _compArgs(t, p)
        return _renderLink(t)(compProps as any, {
            children: inner,
            attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        })
    }
    if (typeof t !== 'string') return inner
    let a = ''
    for (const [k, v] of Object.entries(p ?? {})) {
        if (_isEvent(k, v) || !_ATTR.test(k)) continue
        const r = _read(v)
        if (r === true) a += ` ${k}`
        else if (r !== false && r != null) {
            a += ` ${k}="${_escHtml(String(r))}"`
        }
    }
    if (VOID.has(t)) return `<${t}${a}>`
    return `<${t}${a}>${inner}</${t}>`
}

export function h (
    type:VType,
    props:Record<string, unknown> | null,
    ...children:unknown[]
):Markup {
    // htm does not know void tags, so an unclosed one takes everything
    // after it as children. Fail loudly instead of dropping them.
    if (typeof type === 'string' && VOID.has(type) && children.length) {
        throw new Error(
            `<${type}> has children: an unclosed void element ` +
            `swallows what follows it. Write it as <${type} />.`
        )
    }
    return new Markup({ t: type, p: props, c: children })
}

const _htm = htm.bind(h)

export function html (
    strings:TemplateStringsArray,
    ...values:unknown[]
):Markup {
    const result = (_htm as (...a:unknown[]) => unknown)(
        strings, ...values
    )
    if (_isMarkup(result)) return result
    return new Markup(Array.isArray(result) ? result : [result])
}

// Mounting

type Off = () => void

// Run DOM work untracked, so hosts connected by it set up their own
// effects outside any region.
function _dom (fn:() => void):void {
    untracked(fn)
}

// The last value each control property was bound to, per element.
const _bound = new WeakMap<Element, Record<string, unknown>>()

// `value`, `checked` and `selected` on form controls are DOM
// properties, written only when the bound value changed, so a
// re-render keeps what the visitor typed and a new value still wins.
function _ctl (el:Element, k:string):boolean {
    return /^(value|checked|selected)$/.test(k) &&
        /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)
}

// Write an attribute; with `keep`, only if it does not already match.
function _setAttr (
    el:Element,
    k:string,
    v:unknown,
    keep?:boolean
):void {
    if (_ctl(el, k)) {
        const o = el as unknown as Record<string, unknown>
        const rec = _bound.get(el) ?? {}
        _bound.set(el, rec)
        const x = k === 'value' ? String(v ?? '') : !!v
        // adopting: compare with what the server wrote (`defaultValue`
        // and so on; a select has none), so a value the visitor typed
        // before hydration stays when the server value matches
        const d = o['default' + k[0].toUpperCase() + k.slice(1)]
        if (k in rec ? !Object.is(rec[k], v) : !(keep && (d ?? o[k]) === x)) {
            o[k] = x
        }
        rec[k] = v
        return
    }
    const s = v === false || v == null ?
        null :
        v === true ? '' : String(v)
    if (keep && el.getAttribute(k) === s) return
    if (s === null) el.removeAttribute(k)
    else el.setAttribute(k, s)
}

function _listen (el:Element, k:string, fn:unknown, offs:Off[]):void {
    const type = k.slice(2)
    const handler = fn as EventListener
    el.addEventListener(type, handler)
    offs.push(() => el.removeEventListener(type, handler))
}

function _parse (s:string):DocumentFragment {
    const tpl = document.createElement('template')
    tpl.innerHTML = s
    // importNode upgrades defined custom elements synchronously
    return document.importNode(tpl.content, true)
}

// Flatten a child value into the items a range holds: node
// descriptions, regions (functions), parsed raw HTML and text.
function _items (c:unknown, out:unknown[] = []):unknown[] {
    if (c == null || c === false) return out
    if (Array.isArray(c)) {
        for (const x of c) _items(x, out)
    } else if (_isMarkup(c)) {
        // a node description, else HTML (`raw`, or server markup)
        if (c._n) _items(c._n, out)
        else out.push(..._parse(String(c)).childNodes)
    } else if (
        typeof c === 'object' && !(c instanceof Node) && 'p' in c &&
        typeof (c as VNode).t !== 'string' &&
        !_isMicrotag((c as VNode).t)
    ) {
        _items((c as VNode).c, out)
    } else {
        out.push(c)
    }
    return out
}

function _create (c:unknown, offs:Off[]):Node[] {
    if (c instanceof Node) return [c]
    if (typeof c === 'function') return _region(c as () => unknown, offs)
    if (typeof c !== 'object' || c === null || !('t' in c)) {
        return [document.createTextNode(String(c))]
    }
    const { t, p, c: kids } = c as VNode
    if (_isMicrotag(t)) return [_createHost(t, p, kids, offs)]
    const el = document.createElement(t as string)
    // children first: a select's value needs its options
    _morph(el, null, null, kids, offs)
    _bindEl(el, p, offs)
    return [el]
}

// Bind attributes and listeners. When adopting, static values are
// left as the server wrote them (a control's is compared like a bound
// one), and a bound value's first run writes only if it differs from
// the attribute already there.
function _bindEl (
    el:Element,
    p:Record<string, unknown> | null,
    offs:Off[],
    adopt?:boolean
):void {
    for (const [k, v] of Object.entries(p ?? {})) {
        if (_isEvent(k, v)) {
            _listen(el, k, v, offs)
        } else if (!_ATTR.test(k)) {
            continue
        } else if (typeof v === 'function') {
            let first = adopt
            effect(() => {
                _setAttr(el, k, (v as () => unknown)(), first)
                first = false
            })
        } else if (!adopt || _ctl(el, k)) {
            // an adopted control's static value seeds its record
            _setAttr(el, k, v, adopt)
        }
    }
}

function _bindHost (
    host:Element,
    type:Comp,
    p:Record<string, unknown> | null,
    offs:Off[],
    adopt?:boolean
):void {
    const declared = new Set(type.props as readonly string[])
    for (const [k, v] of Object.entries(p ?? {})) {
        if (_isEvent(k, v)) {
            _listen(host, k, v, offs)
        } else if (declared.has(k)) {
            // a signal makes the prop read through to it
            (host as unknown as Record<string, unknown>)[k] = v
        } else if (k === 'key') {
            _setAttr(host, k, _read(v), adopt)
        }
    }
}

function _createHost (
    type:Comp,
    p:Record<string, unknown> | null,
    kids:unknown[],
    offs:Off[]
):Element {
    const { compProps, attrs } = _compArgs(type, p)
    const inner = _str(kids)
    let host!:Element
    // A kept component's render static needs the support module.
    register()
    _dom(() => {
        const out = _renderLink(type)(compProps as any, {
            children: kids.length > 0 ? `<!--[c-->${inner}<!--]-->` : inner,
            attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        })
        host = _parse(String(out)).firstElementChild!
    })
    _bindHost(host, type, p, offs)
    return host
}

// A reactive region: nodes between two comment markers, morphed toward
// the function's new value whenever what it reads changes. Given
// existing markers, the first run adopts the nodes between them.
function _region (
    fn:() => unknown,
    offs:Off[],
    at?:[Node, Node]
):Node[] {
    const start = at ? at[0] : document.createComment('[')
    const end = at ? at[1] : document.createComment(']')
    const frag = document.createDocumentFragment()
    if (!at) frag.append(start, end)
    let own:Off[] = []
    let adopt = !!at
    effect(() => {
        const v = fn()
        for (const off of own) off()
        own = []
        if (adopt) _adopt(start.parentNode!, start, end, v, own)
        else _morph(start.parentNode!, start, end, v, own)
        adopt = false
    })
    offs.push(() => { for (const off of own) off() })
    return Array.from(frag.childNodes)
}

function _key (x:unknown):string | null {
    if (x instanceof Element) return x.getAttribute('key')
    if (typeof x === 'object' && x !== null && 'p' in x) {
        const k = (x as VNode).p?.key
        return k == null ? null : String(_read(k))
    }
    return null
}

function _tag (x:VNode):string {
    return (_isMicrotag(x.t) ? x.t.TAG : x.t as string).toUpperCase()
}

// Find a host's children range, opened by its own marker so a region
// in the host's render is not mistaken for it. Skips nested hosts.
function _range (host:Element):[Node, Node] | null {
    const w = document.createTreeWalker(
        host,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
        {
            acceptNode: n => n instanceof Element && n.tagName.includes('-') ?
                NodeFilter.FILTER_REJECT :
                NodeFilter.FILTER_ACCEPT,
        }
    )
    let n:Node | null
    while ((n = w.nextNode())) {
        if (n instanceof Comment && n.data === '[c') {
            const end = _close(n)
            if (end) return [n, end]
        }
    }
    return null
}

// Patch an old node toward a new item, or return null if it cannot be.
function _patch (old:Node, item:unknown, offs:Off[]):Node | null {
    if (typeof item === 'function' || item instanceof Node) return null
    if (typeof item !== 'object' || item === null || !('t' in item)) {
        if (old.nodeType !== Node.TEXT_NODE) return null
        const s = String(item)
        if (old.textContent !== s) old.textContent = s
        return old
    }
    const v = item as VNode
    if (!(old instanceof Element) || old.tagName !== _tag(v)) return null
    if (_isMicrotag(v.t)) {
        _bindHost(old, v.t, v.p, offs)
        const r = _range(old)
        if (r) _morph(r[0].parentNode!, r[0], r[1], v.c, offs)
        return old
    }
    const next = new Set(Object.keys(v.p ?? {}))
    for (const a of Array.from(old.attributes)) {
        if (!next.has(a.name)) old.removeAttribute(a.name)
    }
    _morph(old, null, null, v.c, offs)
    _bindEl(old, v.p, offs)
    return old
}

/**
 * Morph the nodes of `parent` between `start` and `end` (exclusive;
 * null means the edge) toward `value`. Keyed elements are matched by
 * key, the rest by position; unmatched old nodes are removed.
 */
function _morph (
    parent:Node,
    start:Node | null,
    end:Node | null,
    value:unknown,
    offs:Off[]
):void {
    const old:Node[] = []
    for (
        let n = start ? start.nextSibling : parent.firstChild;
        n && n !== end;
        n = n.nextSibling
    ) old.push(n)
    const keyed = new Map<string, Node>()
    const unkeyed:Node[] = []
    for (const n of old) {
        const k = _key(n)
        if (k !== null) keyed.set(k, n)
        else unkeyed.push(n)
    }

    let u = 0
    const nodes:Node[] = []
    const used = new Set<Node>()
    const seen = new Set<string>()
    for (const item of _items(value)) {
        const k = _key(item)
        if (k !== null) {
            if (seen.has(k)) throw new Error('duplicate key ' + k)
            seen.add(k)
        }
        const cand = k !== null ? keyed.get(k) : unkeyed[u]
        const kept = cand && !used.has(cand) ?
            _patch(cand, item, offs) :
            null
        if (k === null && kept) u++
        if (kept) {
            used.add(kept)
            nodes.push(kept)
        } else {
            nodes.push(..._create(item, offs))
        }
    }

    _dom(() => {
        for (const n of old) {
            if (!used.has(n)) (n as ChildNode).remove()
        }
        // place from the end, moving only nodes out of position
        let ref:Node | null = end
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i]
            if (n.parentNode !== parent || n.nextSibling !== ref) {
                const p = parent as Node & {
                    moveBefore?:(n:Node, r:Node | null) => void
                }
                // kept nodes move when the parent is connected; a
                // missing or throwing moveBefore falls back to insert
                let moved = used.has(n) && parent.isConnected
                if (moved) {
                    try { p.moveBefore!(n, ref) } catch { moved = false }
                }
                if (!moved) parent.insertBefore(n, ref)
            }
            ref = n
        }
    })
}

// The comment closing the region or children range opened by `start`.
function _close (start:Node):Node | null {
    let depth = 0
    for (let s = start.nextSibling; s; s = s.nextSibling) {
        if (!(s instanceof Comment)) continue
        if (s.data === '[' || s.data === '[c') depth++
        else if (s.data === ']' && depth-- === 0) return s
    }
    return null
}

// Next node to adopt: skips whitespace text and comments other than
// region markers.
function _skip (n:Node | null, end:Node | null):Node | null {
    while (n && n !== end && (
        (n instanceof Comment && n.data !== '[') ||
        (n.nodeType === Node.TEXT_NODE && !n.textContent!.trim())
    )) n = n.nextSibling
    return n === end ? null : n
}

/**
 * Bind `value` to the nodes of `parent` between `start` and `end`,
 * which the server rendered from the same markup. Creates no nodes.
 * Hosts are opaque except for their marked children range.
 */
function _adopt (
    parent:Node,
    start:Node | null,
    end:Node | null,
    value:unknown,
    offs:Off[]
):void {
    let n:Node | null = start ? start.nextSibling : parent.firstChild
    for (const item of _items(value)) {
        if (item instanceof Node) {
            // parsed raw HTML: one DOM node per parsed node. Skip only
            // before the span (its first node has no previous sibling
            // in the parsed fragment), and only nodes that could not be
            // that first node.
            if (!item.previousSibling) {
                while (
                    n && n !== end && n.nodeType !== item.nodeType &&
                    _skip(n, end) !== n
                ) n = n.nextSibling
            }
            // a text node only consumes text: one that meets an
            // element was merged into the text before it
            if (n && n !== end && (
                item.nodeType !== 3 || n.nodeType === 3
            )) n = n.nextSibling
            continue
        }
        if (typeof item === 'function') {
            n = _skip(n, end)
            const close = n instanceof Comment ? _close(n) : null
            if (!close) {
                console.warn('microtags: adopt: missing region markers')
                continue
            }
            _region(item as () => unknown, offs, [n!, close])
            n = close.nextSibling
            continue
        }
        if (typeof item !== 'object' || item === null || !('t' in item)) {
            if (n && n !== end && n.nodeType === Node.TEXT_NODE) {
                n = n.nextSibling
            }
            continue
        }
        n = _skip(n, end)
        const v = item as VNode
        const tag = _tag(v)
        if (!(n instanceof Element) || n.tagName !== tag) {
            console.warn(
                `microtags: adopt: expected <${tag.toLowerCase()}>, ` +
                `found ${n instanceof Element ? `<${n.localName}>` : 'none'}`
            )
            // look ahead for the expected tag, stepping over regions;
            // if none, try the next item against the same node
            let m = n
            while (m && m !== end && (
                !(m instanceof Element) || m.tagName !== tag
            )) {
                m = (m instanceof Comment && /^\[c?$/.test(m.data) &&
                    _close(m)) || m
                // a close at `end` means the range is unbalanced
                if (m !== end) m = m.nextSibling
            }
            if (!m || m === end) continue
            n = m
        }
        const el = n as Element
        if (_isMicrotag(v.t)) {
            _bindHost(el, v.t, v.p, offs, true)
            const r = _range(el)
            if (r) _adopt(r[0].parentNode!, r[0], r[1], v.c, offs)
        } else {
            _bindEl(el, v.p, offs, true)
            _adopt(el, null, null, v.c, offs)
        }
        n = n.nextSibling
    }
}

const _mounted = new WeakSet<Element>()

/**
 * Turn markup into DOM inside `container`, binding signals and
 * listeners. Returns a function that stops the bindings and removes
 * the listeners, leaving the DOM in place.
 */
export function mount (container:Element, markup:Markup):() => void {
    if (_mounted.has(container)) {
        throw new Error('microtags: this container is already mounted')
    }
    _mounted.add(container)
    const offs:Off[] = []
    const stop = effectScope(() => {
        if (container.firstChild) _adopt(container, null, null, markup, offs)
        else _morph(container, null, null, markup, offs)
    })
    return () => {
        stop()
        for (const off of offs) off()
        offs.length = 0
    }
}
