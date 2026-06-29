import { define } from '../src/index.js'
import { refsDSL } from '../src/builders.js'
import type {
    RefsMap,
    SingleRefDef,
    MultipleRefDef,
} from '../src/types.js'

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

// A component that declares no refs still exposes an empty `.refs` map.
const _noRefsProbe = define('mt-norefs-probe').setup(() => {})
type _refsEmpty = Expect<Equal<keyof typeof _noRefsProbe.refs, never>>
