import { define } from '../src/index.js'
import { refsDSL } from '../src/builders.js'
import { html, type Markup } from '../src/htm.js'
import type {
    RefsMap,
    SingleRefDef,
    MultipleRefDef,
    TypedEvent,
} from '../src/types.js'
import type {
    Signal as PublicSignal,
    Serialized as PublicSerialized,
    RenderParts as PublicRenderParts,
} from 'microtags'
import { bindProp } from 'microtags'
import { signal, computed } from 'alien-signals'
import { toPreact } from 'microtags/preact'
import type { toPreact as serverToPreact } from '../src/preact.js'
import type { toPreact as browserToPreact } from '../src/preact.browser.js'
import type { toPreact as distServerToPreact } from '../dist/preact.js'

/**
 * Compile-time assertions for the typed-refs feature. This file is never
 * executed or bundled into the runtime suite; it is type-checked by
 * `npm run typecheck` and exists purely to gate the ref type behaviour.
 */

// Type-level equality helpers (the standard Equal / Expect pattern).
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends
    (<T>() => T extends Y ? 1 : 2) ? true : false
type Expect<T extends true> = T

// RefsMap maps a single marker to its element type.
type _mapDisplay = Expect<Equal<
    RefsMap<{ display:SingleRefDef<HTMLDivElement> }>['display'],
    HTMLDivElement
>>

// An un-annotated single marker defaults to HTMLElement.
type _mapDefault = Expect<Equal<
    RefsMap<{ host:SingleRefDef }>['host'],
    HTMLElement
>>

// A multi marker maps to an array of its element type.
type _mapMulti = Expect<Equal<
    RefsMap<{ items:MultipleRefDef<HTMLLIElement> }>['items'],
    HTMLLIElement[]
>>

// An un-annotated multi marker defaults to HTMLElement[].
type _mapMultiDefault = Expect<Equal<
    RefsMap<{ items:MultipleRefDef }>['items'],
    HTMLElement[]
>>

// The DSL infers element types from its arguments.
const _oneBare = refsDSL.one()
const _oneTag = refsDSL.one('button')
const _oneGeneric = refsDSL.one<HTMLInputElement>()
const _allTag = refsDSL.all('li')

type _dslBare = Expect<Equal<typeof _oneBare, SingleRefDef<HTMLElement>>>
type _dslTag = Expect<Equal<
    typeof _oneTag,
    SingleRefDef<HTMLButtonElement>
>>
type _dslGeneric = Expect<Equal<
    typeof _oneGeneric,
    SingleRefDef<HTMLInputElement>
>>
type _dslAll = Expect<Equal<typeof _allTag, MultipleRefDef<HTMLLIElement>>>

const _allBare = refsDSL.all()
type _dslAllBare = Expect<Equal<
    typeof _allBare,
    MultipleRefDef<HTMLElement>
>>

// Types flow end-to-end through withRefs into ctx.refs. If the RefDef
// constraint regressed to a union of concrete markers, the callback's
// object literal would be contextually typed and `host` would collapse to
// `Element`, which is NOT assignable to HTMLElement below.
function expectAssignable<T> (_value:T):void {}

define('mt-types-probe')
    .withRefs(r => ({
        display: r.one<HTMLDivElement>(),
        host: r.one(),
        save: r.one('button'),
        items: r.all('li'),
    }))
    .setup(ctx => {
        expectAssignable<HTMLDivElement>(ctx.refs.display)
        expectAssignable<HTMLElement>(ctx.refs.host)
        expectAssignable<HTMLButtonElement>(ctx.refs.save)
        expectAssignable<HTMLLIElement[]>(ctx.refs.items)
    })

// The registered class exposes `.refs`: each declared ref key mapped to its
// own name as a string literal, so SSR can write `data-ref="${El.refs.dec}"`.
const _refsProbe = define('mt-refs-probe')
    .withRefs(r => ({
        display: r.one<HTMLDivElement>(),
        dec: r.one(),
        copy: r.one('button'),
    }))
    .setup(() => {})

type _refDecLiteral = Expect<Equal<typeof _refsProbe.refs.dec, 'dec'>>
type _refKeys = Expect<Equal<
    keyof typeof _refsProbe.refs,
    'display' | 'dec' | 'copy'
>>

// Static render is typed from withProps: wrong prop type fails typecheck.
const _renderProbe = define('mt-render-probe')
    .withProps(r => ({
        count: r.number(),
        label: r.string(),
    }))
    .render(({ props }) => `<span>${props.count}</span>`)
    .setup(() => {})

// Correct usage compiles
_renderProbe.render({ count: 5, label: 'hi' })

// @ts-expect-error: string where number expected
_renderProbe.render({ count: 'bad', label: 'hi' })

// renderParts takes the same typed props and returns RenderParts.
type _renderPartsReturn = Expect<Equal<
    ReturnType<typeof _renderProbe.renderParts>,
    PublicRenderParts
>>
type _renderPartsShape = Expect<Equal<
    PublicRenderParts,
    { tag:string; attrs:Record<string, string>; html:string }
>>
_renderProbe.renderParts({ count: 5, label: 'hi' }, { children: '' })

// @ts-expect-error: string where number expected
_renderProbe.renderParts({ count: 'bad', label: 'hi' })

// props static lists declared names
type _renderProps = Expect<Equal<
    typeof _renderProbe.props,
    readonly ('count' | 'label')[]
>>

// A component that declares no refs still exposes an empty `.refs` map.
const _noRefsProbe = define('mt-norefs-probe').setup(() => {})
type _refsEmpty = Expect<Equal<keyof typeof _noRefsProbe.refs, never>>

// TypedEvent narrows `detail` to D, and D defaults to `unknown`.
type _evtDetail = Expect<Equal<
    TypedEvent<HTMLElement, { index:number }>['detail'],
    { index:number }
>>
type _evtDetailDefault = Expect<Equal<
    TypedEvent<HTMLElement>['detail'],
    unknown
>>

// TypedEvent narrows `target` to T while staying a CustomEvent.
class XTabs extends HTMLElement {}
declare const _tabsEvt:TypedEvent<XTabs, { index:number }>
expectAssignable<XTabs>(_tabsEvt.target)
expectAssignable<CustomEvent>(_tabsEvt)

// `html` returns opaque markup, not a string.
const _markup = html`<p>hi</p>`
type _isMarkup = Expect<Equal<typeof _markup, Markup>>
// @ts-expect-error: markup is not assignable to string
const _notString:string = _markup

// Hosts expose a typed accessor for each declared prop.
const _AccessorProbe = define('mt-accessor-probe')
    .withProps(p => ({ count: p.number(), label: p.string() }))
    .setup(() => {})
declare const _accessorHost:InstanceType<typeof _AccessorProbe>
type _accessorCount = Expect<Equal<typeof _accessorHost.count, number>>
type _accessorLabel = Expect<Equal<typeof _accessorHost.label, string>>
_accessorHost.count = 3
// @ts-expect-error: string where number expected
_accessorHost.count = 'bad'

// bindProp takes a signal or computed whose value matches the prop type.
bindProp(_accessorHost, 'count', signal(1))
bindProp(_accessorHost, 'label', computed(() => 'x'))
// @ts-expect-error: a string signal for a number prop
bindProp(_accessorHost, 'count', signal('1'))
// @ts-expect-error: a number computed for a string prop
bindProp(_accessorHost, 'label', computed(() => 1))
// @ts-expect-error: only declared props, not HTMLElement properties
bindProp(_accessorHost, 'id', signal('x'))

// Signal and Serialized are public types on the core entry.
type _serializedPublic = Expect<Equal<
    PublicSerialized<{ n:PublicSignal<number> }>,
    { n:number }
>>

// Serialized unwraps each signal property to its value type.
type _serializedUnwrap = Expect<Equal<
    PublicSerialized<{ a:PublicSignal<number>; b:PublicSignal<string[]> }>,
    { a:number; b:string[] }
>>

// Non-signal properties pass through Serialized unchanged.
type _serializedPassThrough = Expect<Equal<
    PublicSerialized<{
        a:PublicSignal<number>;
        n:number;
        tags:string[];
        meta:{ id:string }|null;
    }>,
    { a:number; n:number; tags:string[]; meta:{ id:string }|null }
>>

// The unwrap is shallow: signals nested inside a property are kept.
type _serializedShallow = Expect<Equal<
    PublicSerialized<{
        outer:PublicSignal<{ inner:PublicSignal<number> }>;
        plain:{ inner:PublicSignal<string> };
    }>,
    {
        outer:{ inner:PublicSignal<number> };
        plain:{ inner:PublicSignal<string> };
    }
>>

// microtags/preact: the adapter's props are typed from the class.
const PreactEl = define('types-preact')
    .withProps(p => ({ count: p.number(), label: p.string() }))
    .render(({ props }) => `${props.count}`)
    .setup(() => {})
const _PreactC = toPreact(PreactEl, {
    events: { onChange: 'types-preact:change' },
})
type PreactCProps = Parameters<typeof _PreactC>[0]

// Declared props are accepted with their types; so is a mapped callback.
export const _preactOk:PreactCProps = {
    count: 1,
    label: 'a',
    onChange: (_ev:CustomEvent) => {},
    class: 'c',
    id: 'i',
    'aria-label': 'l',
    'data-x': 1,
}
type _preactCount = Expect<Equal<PreactCProps['count'], number | undefined>>

// @ts-expect-error an undeclared prop
export const _preactUndeclared:PreactCProps = { nope: 1 }
// @ts-expect-error a wrongly typed prop
export const _preactWrongType:PreactCProps = { count: 'one' }
// @ts-expect-error children
export const _preactChildren:PreactCProps = { children: 'kid' }

// The browser build of microtags/preact has the same type as the
// default build. The root typecheck resolves `microtags/preact` with
// the `browser` condition, so that import is the browser build too.
type _preactBuildsEqual = Expect<Equal<
    typeof browserToPreact,
    typeof serverToPreact
>>
type _preactPublicEqual = Expect<Equal<
    typeof toPreact,
    typeof distServerToPreact
>>
