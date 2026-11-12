import { test } from '@substrate-system/tapzero'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { signal, effect, computed } from 'alien-signals'
import { peek, untracked, define, bindProp } from '../src/index.js'
import { factory } from '../src/factory.js'
import { coerceNumber } from '../src/util.js'
import { ComponentBuilder } from '../src/builders.js'
import { createContext, provide } from '../src/context.js'
import type { ContextToken } from '../src/types.js'
import { render, renderList } from '../src/render.js'
import { html, raw } from '../src/htm.js'
import { parityCases, stripMarkers } from './parity.js'
import {
    html as bhtml,
    raw as braw,
    mount,
} from '../src/htm.browser.js'
import { Counter } from '../example-hydration/components/counter.js'
import { Badge } from '../example-hydration/components/badge.js'
import { Notice } from '../example-hydration/components/notice.js'
import { NoticePage } from '../example-hydration/pages/notice.js'
// `microtags/htm` resolves to dist, a second copy of the templater
import {
    mount as pageMount,
    html as dhtml,
    raw as draw,
} from 'microtags/htm'
import { State } from '../example-hydration/state.js'

test('placeholder test', t => {
    t.ok(true, 'test harness is wired')
})

test('peek reads a signal without subscribing', t => {
    const count = signal(0)
    let runs = 0

    effect(() => {
        runs++
        // peek inside an effect should NOT create a subscription
        peek(count)
    })

    t.equal(runs, 1, 'effect runs once on creation')

    count(1)
    t.equal(runs, 1, 'effect does NOT re-run when peeked signal changes')
})

test('untracked reads do not create subscriptions', t => {
    const a = signal(10)
    let runs = 0

    effect(() => {
        runs++
        untracked(() => a())
    })

    t.equal(runs, 1, 'effect runs once on creation')
    a(20)
    t.equal(runs, 1, 'effect does NOT re-run after untracked read')
})

test('peek returns current signal value', t => {
    const s = signal('hello')
    t.equal(peek(s), 'hello', 'peek returns current value')
    s('world')
    t.equal(peek(s), 'world', 'peek returns updated value')
})

test('untracked restores subscription context', t => {
    const a = signal(0)
    const b = signal(0)
    let runs = 0

    effect(() => {
        runs++
        a() // tracked
        untracked(() => b()) // not tracked
    })

    t.equal(runs, 1, 'initial run')
    b(1)
    t.equal(runs, 1, 'b change does not trigger re-run')
    a(1)
    t.equal(runs, 2, 'a change does trigger re-run')
})

// US-011: define and reactive-props tests

test('define: registers a working custom element', t => {
    define('test-us011-define').setup(() => {})
    const el = document.createElement('test-us011-define')
    document.body.appendChild(el)
    t.ok(el instanceof HTMLElement, 'created element is an HTMLElement')
    t.ok(
        customElements.get('test-us011-define') !== undefined,
        'element is registered in customElements registry'
    )
    document.body.removeChild(el)
})

test('reactive props: reading, writing, and reacting', t => {
    let effectRuns = 0
    let lastValue:number | undefined
    let propSignal:((v?:number) => number) | undefined

    define('test-us011-reactive-props')
        .withProps((p) => ({ count: p.number() }))
        .setup((ctx) => {
            propSignal = ctx.props.count as any
            ctx.effect(() => {
                lastValue = ctx.props.count()
                effectRuns++
            })
        })

    const el = document.createElement('test-us011-reactive-props')
    el.setAttribute('count', '1')
    document.body.appendChild(el)

    t.equal(lastValue, 1, 'effect reads initial prop value')
    t.equal(effectRuns, 1, 'effect ran once on connect')

    // Write to the prop signal directly (not via attribute)
    ;(propSignal as any)(99)
    t.equal(lastValue, 99, 'effect re-ran after writing to prop signal')
    t.equal(effectRuns, 2, 'effect ran twice total')

    document.body.removeChild(el)
})

// US-004: factory lifecycle tests

test('factory: creates HTMLElement subclass with no shadow DOM', t => {
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: () => {},
    })
    customElements.define('test-factory-basic', El)
    const el = document.createElement('test-factory-basic')
    document.body.appendChild(el)
    t.ok(el instanceof HTMLElement, 'is an HTMLElement')
    t.equal(el.shadowRoot, null, 'no shadow DOM')
    document.body.removeChild(el)
})

test('factory: connectedCallback hydrates props from attributes', t => {
    let capturedCount:number | undefined
    const El = factory({
        props: { count: coerceNumber },
        observedAttrNames: ['count'],
        setup: (ctx) => {
            capturedCount = ctx.props.count()
        },
    })
    customElements.define('test-factory-hydrate', El)
    const el = document.createElement('test-factory-hydrate')
    el.setAttribute('count', '42')
    document.body.appendChild(el)
    t.equal(capturedCount, 42, 'prop hydrated from attribute on connect')
    document.body.removeChild(el)
})

test('factory: attributeChangedCallback updates prop signal', t => {
    let effectRunCount = 0
    const El = factory({
        props: { count: coerceNumber },
        observedAttrNames: ['count'],
        setup: (ctx) => {
            ctx.effect(() => {
                ctx.props.count() // track the signal
                effectRunCount++
            })
        },
    })
    customElements.define('test-factory-attr-changed', El)
    const el = document.createElement('test-factory-attr-changed')
    document.body.appendChild(el)
    t.equal(effectRunCount, 1, 'effect ran once on connect')
    el.setAttribute('count', '5')
    t.equal(effectRunCount, 2, 'effect re-ran after attributeChangedCallback')
    document.body.removeChild(el)
})

test('factory: disconnectedCallback runs all registered cleanups', async t => {
    let cleanupCount = 0
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.onCleanup(() => cleanupCount++)
            ctx.onCleanup(() => cleanupCount++)
        },
    })
    customElements.define('test-factory-cleanup', El)
    const el = document.createElement('test-factory-cleanup')
    document.body.appendChild(el)
    t.equal(cleanupCount, 0, 'cleanups not run before disconnect')
    document.body.removeChild(el)
    await Promise.resolve()
    t.equal(cleanupCount, 2, 'both cleanups ran on disconnect')
})

test('factory: effects are disposed on disconnect', async t => {
    let effectRunCount = 0
    const count = signal(0)
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.effect(() => {
                count() // track external signal
                effectRunCount++
            })
        },
    })
    customElements.define('test-factory-effect-dispose', El)
    const el = document.createElement('test-factory-effect-dispose')
    document.body.appendChild(el)
    t.equal(effectRunCount, 1, 'effect ran on connect')
    count(1)
    t.equal(effectRunCount, 2, 'effect ran after signal change')
    document.body.removeChild(el)
    await Promise.resolve()
    count(2)
    t.equal(effectRunCount, 2, 'effect did NOT run after disconnect')
})

test('factory: reconnecting re-runs setup with fresh scope', async t => {
    let setupCount = 0
    let cleanupCount = 0
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            setupCount++
            ctx.onCleanup(() => cleanupCount++)
        },
    })
    customElements.define('test-factory-reconnect', El)
    const el = document.createElement('test-factory-reconnect')
    document.body.appendChild(el)
    t.equal(setupCount, 1, 'setup ran once on first connect')
    document.body.removeChild(el)
    await Promise.resolve()
    t.equal(cleanupCount, 1, 'cleanup ran on disconnect')
    document.body.appendChild(el)
    t.equal(setupCount, 2, 'setup re-ran on reconnect')
    document.body.removeChild(el)
    await Promise.resolve()
    t.equal(cleanupCount, 2, 'cleanup ran again on second disconnect')
})

test('factory: a same-tick insertBefore move keeps the host set up', async t => {
    let setups = 0
    let cleanups = 0
    define('test-factory-insert-move')
        .setup(ctx => {
            setups++
            ctx.onCleanup(() => cleanups++)
        })
    const box = document.createElement('div')
    const el = document.createElement('test-factory-insert-move')
    const other = document.createElement('p')
    box.append(el, other)
    document.body.appendChild(box)
    box.insertBefore(other, el)
    box.insertBefore(el, other)
    await Promise.resolve()
    t.equal(cleanups, 0, 'no cleanups ran')
    t.equal(setups, 1, 'setup did not run again')
    box.remove()
})

test('factory: a real removal runs cleanups once, after a microtask', async t => {
    let cleanups = 0
    define('test-factory-remove-once')
        .setup(ctx => { ctx.onCleanup(() => cleanups++) })
    const el = document.createElement('test-factory-remove-once')
    document.body.appendChild(el)
    el.remove()
    await Promise.resolve()
    t.equal(cleanups, 1, 'cleanups ran exactly once')
    await Promise.resolve()
    t.equal(cleanups, 1, 'and not again')
})

test('factory: removing a host twice in one tick cleans up once', async t => {
    let setups = 0
    let cleanups = 0
    define('test-factory-remove-twice')
        .setup(ctx => {
            setups++
            ctx.onCleanup(() => cleanups++)
        })
    const el = document.createElement('test-factory-remove-twice')
    document.body.appendChild(el)
    el.remove()
    document.body.appendChild(el)
    el.remove()
    await Promise.resolve()
    t.equal(cleanups, 1, 'cleanups ran once')
    t.equal(setups, 1, 'setup ran once')
})

test('factory: reconnecting after teardown runs setup again', async t => {
    let setups = 0
    let cleanups = 0
    define('test-factory-reconnect-after')
        .setup(ctx => {
            setups++
            ctx.onCleanup(() => cleanups++)
        })
    const el = document.createElement('test-factory-reconnect-after')
    document.body.appendChild(el)
    el.remove()
    await Promise.resolve()
    document.body.appendChild(el)
    t.equal(cleanups, 1, 'first connection was torn down')
    t.equal(setups, 2, 'setup ran again')
    el.remove()
    await Promise.resolve()
    t.equal(cleanups, 2, 'second connection torn down')
})

test('factory: reconnect preserves programmatically-set prop values', async t => {
    // Capture the signal reference during setup so we can write to it directly
    // (simulates external code setting a prop without going through attributes)
    let capturedSignal:((v?:number) => number) | null = null
    const captured:number[] = []
    const El = factory({
        props: { count: coerceNumber },
        observedAttrNames: ['count'],
        setup: (ctx) => {
            if (capturedSignal === null) {
                capturedSignal = ctx.props.count as any
            }
            captured.push(ctx.props.count())
        },
    })
    customElements.define('test-factory-preserve', El)
    const el = document.createElement('test-factory-preserve')
    document.body.appendChild(el) // first connect: no attr → count = NaN
    ;(capturedSignal as any)(42) // programmatically set count to 42
    document.body.removeChild(el) // disconnect: cleanups run, signal stays 42
    await Promise.resolve()
    document.body.appendChild(el) // reconnect: no attr → signal keeps 42
    t.equal(captured[1], 42, 'reconnect: programmatically-set value preserved')
    document.body.removeChild(el)
})

/**
 * Teardown runs in a queued microtask, where a throwing cleanup would
 * reach the page as an uncaught error and fail the run. Capture the
 * tasks queued by `remove`, run them here, and return the first error.
 */
function catchTeardown (remove:() => void):Error|null {
    const queue = window.queueMicrotask
    const tasks:VoidFunction[] = []
    window.queueMicrotask = fn => { tasks.push(fn) }
    try {
        remove()
    } finally {
        window.queueMicrotask = queue
    }
    let caught:Error|null = null
    for (const fn of tasks) {
        try {
            fn()
        } catch (err) {
            caught ??= err as Error
        }
    }
    return caught
}

test('factory: cleanup errors: remaining cleanups run, first error re-throws', t => {
    let secondCleanupRan = false
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.onCleanup(() => { throw new Error('first') })
            ctx.onCleanup(() => { secondCleanupRan = true })
        },
    })
    customElements.define('test-factory-cleanup-err', El)
    const el = document.createElement('test-factory-cleanup-err')
    document.body.appendChild(el)

    const caughtErr = catchTeardown(() => document.body.removeChild(el))
    t.ok(secondCleanupRan, 'second cleanup ran despite first throwing')
    t.ok(caughtErr !== null, 'first error was re-thrown')
    t.equal(caughtErr?.message, 'first', 'correct error re-thrown')
})

// US-005: withProps builder tests

test('withProps: p.number() hydrates number from attribute', t => {
    let capturedValue:number | undefined
    new ComponentBuilder('test-wp-number')
        .withProps((p) => ({ count: p.number() }))
        .setup((ctx) => { capturedValue = ctx.props.count() })

    const el = document.createElement('test-wp-number')
    el.setAttribute('count', '7')
    document.body.appendChild(el)
    t.equal(capturedValue, 7, 'number prop coerced from attribute')
    document.body.removeChild(el)
})

test('withProps: p.string() hydrates string from attribute', t => {
    let capturedValue:string | undefined
    new ComponentBuilder('test-wp-string')
        .withProps((p) => ({ label: p.string() }))
        .setup((ctx) => { capturedValue = ctx.props.label() })

    const el = document.createElement('test-wp-string')
    el.setAttribute('label', 'hello')
    document.body.appendChild(el)
    t.equal(capturedValue, 'hello', 'string prop hydrated from attribute')
    document.body.removeChild(el)
})

test('withProps: p.boolean() coerces attribute presence', t => {
    let capturedTrue:boolean | undefined
    let capturedFalse:boolean | undefined

    new ComponentBuilder('test-wp-bool-true')
        .withProps((p) => ({ active: p.boolean() }))
        .setup((ctx) => { capturedTrue = ctx.props.active() })

    new ComponentBuilder('test-wp-bool-false')
        .withProps((p) => ({ active: p.boolean() }))
        .setup((ctx) => { capturedFalse = ctx.props.active() })

    const elT = document.createElement('test-wp-bool-true')
    elT.setAttribute('active', '')
    document.body.appendChild(elT)
    t.equal(capturedTrue, true, 'boolean true when attribute present')
    document.body.removeChild(elT)

    const elF = document.createElement('test-wp-bool-false')
    document.body.appendChild(elF)
    t.equal(capturedFalse, false, 'boolean false when attribute absent')
    document.body.removeChild(elF)
})

test('withProps: p.json() parses attribute as JSON', t => {
    let capturedValue:{ x:number } | undefined
    new ComponentBuilder('test-wp-json')
        .withProps((p) => ({ data: p.json<{ x: number }>() }))
        .setup((ctx) => { capturedValue = ctx.props.data() })

    const el = document.createElement('test-wp-json')
    el.setAttribute('data', '{"x":42}')
    document.body.appendChild(el)
    t.deepEqual(capturedValue, { x: 42 }, 'json prop parsed from attribute')
    document.body.removeChild(el)
})

test('withProps: p.schema() accepts a Standard Schema validator', t => {
    const numSchema:StandardSchemaV1<unknown, number> = {
        '~standard': {
            version: 1,
            vendor: 'test',
            validate: (value) => {
                const n = Number(value)
                return isNaN(n)
                    ? { issues: [{ message: 'not a number' }] }
                    : { value: n }
            },
        },
    }

    let capturedValue:number | undefined
    new ComponentBuilder('test-wp-schema')
        .withProps((p) => ({ count: p.schema(numSchema) }))
        .setup((ctx) => { capturedValue = ctx.props.count() })

    const el = document.createElement('test-wp-schema')
    el.setAttribute('count', '99')
    document.body.appendChild(el)
    t.equal(capturedValue, 99, 'schema prop validated and coerced')
    document.body.removeChild(el)
})

test('withProps: p.prop() creates a property-only (non-observed) prop', t => {
    let capturedValue:number | undefined
    let attrChangeCount = 0

    new ComponentBuilder('test-wp-prop-only')
        .withProps((p) => ({ internal: p.prop(42) }))
        .setup((ctx) => {
            capturedValue = ctx.props.internal()
            ctx.effect(() => {
                ctx.props.internal()
                attrChangeCount++
            })
        })

    const el = document.createElement('test-wp-prop-only')
    document.body.appendChild(el)

    t.equal(capturedValue, 42, 'prop() uses initial value')

    // Setting an attribute with the same name should NOT update the signal
    // (attribute is not observed)
    el.setAttribute('internal', '999')
    t.equal(attrChangeCount, 1, 'signal not updated by attribute set')

    document.body.removeChild(el)
})

test('withProps: observed attributes react to attributeChangedCallback', t => {
    let runCount = 0
    new ComponentBuilder('test-wp-observed')
        .withProps((p) => ({ count: p.number() }))
        .setup((ctx) => {
            ctx.effect(() => {
                ctx.props.count()
                runCount++
            })
        })

    const el = document.createElement('test-wp-observed')
    document.body.appendChild(el)
    t.equal(runCount, 1, 'effect ran once on connect')
    el.setAttribute('count', '1')
    t.equal(runCount, 2, 'effect re-ran after attribute change')
    document.body.removeChild(el)
})

// US-006: withRefs and withContexts builder tests

test('withRefs: r.one resolves single [data-ref] element', t => {
    let capturedRef:Element | undefined
    new ComponentBuilder('test-refs-one')
        .withRefs((r) => ({ button: r.one() }))
        .setup((ctx) => { capturedRef = ctx.refs.button })

    const el = document.createElement('test-refs-one')
    const btn = document.createElement('button')
    btn.setAttribute('data-ref', 'button')
    el.appendChild(btn)
    document.body.appendChild(el)
    t.ok(capturedRef === btn, 'r.one resolves to matching element')
    document.body.removeChild(el)
})

test('withRefs: r.all resolves multiple [data-ref] elements', t => {
    let capturedRefs:Element[] | undefined
    new ComponentBuilder('test-refs-all')
        .withRefs((r) => ({ items: r.all() }))
        .setup((ctx) => { capturedRefs = ctx.refs.items })

    const el = document.createElement('test-refs-all')
    const item1 = document.createElement('li')
    item1.setAttribute('data-ref', 'items')
    const item2 = document.createElement('li')
    item2.setAttribute('data-ref', 'items')
    el.appendChild(item1)
    el.appendChild(item2)
    document.body.appendChild(el)
    t.equal(capturedRefs?.length, 2, 'r.all resolves to array')
    t.ok(capturedRefs?.[0] === item1, 'first element matches')
    t.ok(capturedRefs?.[1] === item2, 'second element matches')
    document.body.removeChild(el)
})

test('withRefs: r.all returns empty array when no matches', t => {
    let capturedRefs:Element[] | undefined
    new ComponentBuilder('test-refs-all-empty')
        .withRefs((r) => ({ items: r.all() }))
        .setup((ctx) => { capturedRefs = ctx.refs.items })

    const el = document.createElement('test-refs-all-empty')
    document.body.appendChild(el)
    t.ok(Array.isArray(capturedRefs), 'r.all returns array')
    t.equal(capturedRefs?.length, 0, 'empty array when no matches')
    document.body.removeChild(el)
})

test('withRefs: r.one throws when ref element not found', t => {
    new ComponentBuilder('test-refs-missing')
        .withRefs((r) => ({ missing: r.one() }))
        .setup(() => {})

    const el = document.createElement('test-refs-missing')
    let caughtErr:Error | null = null
    try {
        (el as any).connectedCallback()
    } catch (err) {
        caughtErr = err as Error
    }
    t.ok(caughtErr !== null, 'throws when r.one ref not found')
})

test('withRefs: r.one(selector) resolves by CSS selector', t => {
    let capturedRef:Element | undefined
    new ComponentBuilder('test-refs-one-selector')
        .withRefs((r) => ({ code: r.one('code') }))
        .setup((ctx) => { capturedRef = ctx.refs.code })

    const el = document.createElement('test-refs-one-selector')
    const code = document.createElement('code')
    el.appendChild(code)
    document.body.appendChild(el)
    t.ok(capturedRef === code, 'r.one(selector) resolves by selector')
    document.body.removeChild(el)
})

test('withRefs: r.one(tag) resolves an element by tag name', t => {
    let capturedRef:Element | undefined
    new ComponentBuilder('test-refs-one-tag')
        .withRefs((r) => ({ save: r.one('button') }))
        .setup((ctx) => { capturedRef = ctx.refs.save })

    const el = document.createElement('test-refs-one-tag')
    const btn = document.createElement('button')
    el.appendChild(btn)
    document.body.appendChild(el)
    t.ok(capturedRef === btn, 'r.one(tag) resolves the tag element')
    document.body.removeChild(el)
})

test('withRefs: r.all(selector) resolves multiple by CSS selector', t => {
    let capturedRefs:Element[] | undefined
    new ComponentBuilder('test-refs-all-selector')
        .withRefs((r) => ({ items: r.all('li') }))
        .setup((ctx) => { capturedRefs = ctx.refs.items })

    const el = document.createElement('test-refs-all-selector')
    const item1 = document.createElement('li')
    const item2 = document.createElement('li')
    el.appendChild(item1)
    el.appendChild(item2)
    document.body.appendChild(el)
    t.equal(capturedRefs?.length, 2, 'r.all(selector) resolves to array')
    t.ok(capturedRefs?.[0] === item1, 'first selector element matches')
    t.ok(capturedRefs?.[1] === item2, 'second selector element matches')
    document.body.removeChild(el)
})

test('withContexts: context keys appear in ctx.contexts', t => {
    const ThemeCtx = createContext<string>()
    let capturedContexts:Record<string, unknown> | undefined
    new ComponentBuilder('test-ctx-keys')
        .withContexts(() => ({ theme: ThemeCtx }))
        .setup((ctx) => { capturedContexts = ctx.contexts })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-ctx-keys')
    wrapper.appendChild(el)
    provide(wrapper, ThemeCtx, 'light')
    document.body.appendChild(wrapper)
    t.ok(capturedContexts !== undefined, 'contexts object present')
    t.ok('theme' in (capturedContexts ?? {}), 'context key present')
    document.body.removeChild(wrapper)
})

// US-007: setup context (ctx) tests

test('ctx.on: listener is called and auto-removed on disconnect', async t => {
    let clickCount = 0
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.on(ctx.host, 'click', () => { clickCount++ })
        },
    })
    customElements.define('test-ctx-on', El)
    const el = document.createElement('test-ctx-on')
    document.body.appendChild(el)
    el.click()
    t.equal(clickCount, 1, 'listener fired on click')
    document.body.removeChild(el)
    await Promise.resolve()
    el.click()
    t.equal(clickCount, 1, 'listener not called after disconnect')
})

test('ctx.emit: string form dispatches a bubbling CustomEvent with detail', t => {
    let received:CustomEvent | null = null
    let returned:boolean | null = null
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.on(ctx.host, 'click', () => {
                returned = ctx.emit('ping', { value: 42 })
            })
        },
    })
    customElements.define('test-ctx-emit', El)
    const el = document.createElement('test-ctx-emit')
    const onPing = (ev:Event) => { received = ev as CustomEvent }
    document.body.addEventListener('ping', onPing)
    document.body.appendChild(el)

    el.click()

    t.ok(received, 'event bubbled up to document.body')
    t.equal(received!.detail.value, 42, 'detail passed through')
    t.equal(returned, true, 'returns dispatchEvent result when not canceled')

    document.body.removeEventListener('ping', onPing)
    document.body.removeChild(el)
})

test('ctx.emit: Event form dispatches as-is; returns false when canceled', t => {
    let returned:boolean | null = null
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.on(ctx.host, 'click', () => {
                returned = ctx.emit(
                    new CustomEvent('boom', {
                        bubbles: true,
                        cancelable: true,
                    })
                )
            })
        },
    })
    customElements.define('test-ctx-emit-event', El)
    const el = document.createElement('test-ctx-emit-event')
    const onBoom = (ev:Event) => { ev.preventDefault() }
    document.body.addEventListener('boom', onBoom)
    document.body.appendChild(el)

    el.click()

    t.equal(returned, false, 'returns false when a listener calls preventDefault')

    document.body.removeEventListener('boom', onBoom)
    document.body.removeChild(el)
})

test('ctx.bind: updates DOM property reactively, stops after disconnect', async t => {
    const El = factory({
        props: { label: (v:string | null) => (v ?? 'initial') },
        observedAttrNames: ['label'],
        setup: (ctx) => {
            const input = document.createElement('input')
            ctx.host.appendChild(input)
            ctx.bind(ctx.props.label, input, { prop: 'value' })
        },
    })
    customElements.define('test-ctx-bind', El)
    const el = document.createElement('test-ctx-bind')
    document.body.appendChild(el)
    const inp = el.querySelector('input') as HTMLInputElement
    t.equal(inp.value, 'initial', 'initial value bound')
    el.setAttribute('label', 'updated')
    t.equal(inp.value, 'updated', 'value updated on signal change')
    document.body.removeChild(el)
    await Promise.resolve()
    el.setAttribute('label', 'after-disconnect')
    t.equal(inp.value, 'updated', 'binding stopped after disconnect')
})

test('ctx.bind: two-way text input writes user input to signal', t => {
    const value = signal('initial')
    define('test-ctx-bind-twoway')
        .setup((ctx) => {
            const input = document.createElement('input')
            ctx.host.appendChild(input)
            ctx.bind(value, input)
        })
    const el = document.createElement('test-ctx-bind-twoway')
    document.body.appendChild(el)
    const inp = el.querySelector('input') as HTMLInputElement
    t.equal(inp.value, 'initial',
        'forward: input value set from signal')
    value('updated')
    t.equal(inp.value, 'updated',
        'forward: signal change updates input')
    inp.value = 'typed by user'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    t.equal(value(), 'typed by user',
        'write-back: input event to signal')
    document.body.removeChild(el)
})

test('ctx.bind: checkbox auto-detects checked/change', t => {
    const checked = signal(false)
    define('test-ctx-bind-checkbox')
        .setup((ctx) => {
            const box = document.createElement('input')
            box.type = 'checkbox'
            ctx.host.appendChild(box)
            ctx.bind(checked, box)
        })
    const el = document.createElement('test-ctx-bind-checkbox')
    document.body.appendChild(el)
    const box = el.querySelector('input') as HTMLInputElement
    t.equal(box.checked, false,
        'forward: box unchecked from signal')
    checked(true)
    t.equal(box.checked, true,
        'forward: signal change checks the box')
    box.checked = false
    box.dispatchEvent(new Event('change', { bubbles: true }))
    t.equal(checked(), false,
        'write-back: change event updates signal')
    document.body.removeChild(el)
})

test('ctx.bind: getter one-way derives a property from a signal', t => {
    const count = signal(2)
    define('test-ctx-bind-getter')
        .setup((ctx) => {
            const span = document.createElement('span')
            ctx.host.appendChild(span)
            ctx.bind(() => String(count()), span,
                { prop: 'textContent' })
        })
    const el = document.createElement('test-ctx-bind-getter')
    document.body.appendChild(el)
    const span = el.querySelector('span') as HTMLElement
    t.equal(span.textContent, '2', 'getter sets textContent')
    count(5)
    t.equal(span.textContent, '5',
        're-runs when read signal changes')
    document.body.removeChild(el)
})

test('ctx.bind: number input auto-detects valueAsNumber/input', t => {
    const n = signal(1)
    define('test-ctx-bind-number')
        .setup((ctx) => {
            const input = document.createElement('input')
            input.type = 'number'
            ctx.host.appendChild(input)
            ctx.bind(n, input)
        })
    const el = document.createElement('test-ctx-bind-number')
    document.body.appendChild(el)
    const inp = el.querySelector('input') as HTMLInputElement
    t.equal(inp.valueAsNumber, 1,
        'forward: valueAsNumber from signal')
    n(4)
    t.equal(inp.valueAsNumber, 4,
        'forward: signal change updates input')
    inp.valueAsNumber = 7
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    t.equal(n(), 7,
        'write-back: input event updates signal as number')
    document.body.removeChild(el)
})

test('ctx.peek: no subscription inside ctx.effect', t => {
    let effectRuns = 0
    const mySignal = signal(0)
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            ctx.effect(() => {
                effectRuns++
                ctx.peek(mySignal)
            })
        },
    })
    customElements.define('test-ctx-peek', El)
    const el = document.createElement('test-ctx-peek')
    document.body.appendChild(el)
    t.equal(effectRuns, 1, 'effect ran once on connect')
    mySignal(1)
    t.equal(effectRuns, 1, 'effect did not re-run (peek does not subscribe)')
    document.body.removeChild(el)
})

test('ctx.consume: returns undefined for unresolved context token', t => {
    const MyCtx:ContextToken<string> = { id: Symbol('myCtx') }
    let consumed:string | undefined = 'sentinel'
    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            consumed = ctx.consume(MyCtx)
        },
    })
    customElements.define('test-ctx-consume', El)
    const el = document.createElement('test-ctx-consume')
    document.body.appendChild(el)
    t.equal(consumed, undefined, 'consume returns undefined when no provider')
    document.body.removeChild(el)
})

// US-008: define() fluent entry

test('define: setup() registers the custom element', t => {
    define('test-define-register').setup(() => {})
    t.ok(customElements.get('test-define-register'), 'element registered')
})

test('define: setup() returns the element class', t => {
    const El = define('test-define-returns').setup(() => {})
    const el = document.createElement('test-define-returns')
    t.ok(el instanceof El, 'returned class is the registered element class')
})

test('define: builder exposes TAG', t => {
    t.equal(define('test-define-tag').TAG, 'test-define-tag',
        'TAG returns the tag name')
})

test('define: TAG is available after withProps/withRefs', t => {
    const builder = define('test-define-tag-chain')
        .withProps((p) => ({ count: p.number() }))
        .withRefs((r) => ({ btn: r.one() }))
    t.equal(builder.TAG, 'test-define-tag-chain',
        'TAG propagates through the fluent chain')
})

test('define: setup() element class exposes static TAG', t => {
    const El = define('test-define-tag-class').setup(() => {})
    t.equal(El.TAG, 'test-define-tag-class',
        'registered class carries its tag name')
})

test('define: full chain registers and works', t => {
    let propVal:number | undefined
    define('test-define-chain')
        .withProps((p) => ({ count: p.number() }))
        .setup((ctx) => { propVal = ctx.props.count() })
    const el = document.createElement('test-define-chain')
    el.setAttribute('count', '7')
    document.body.appendChild(el)
    t.equal(propVal, 7, 'prop resolved via define chain')
    document.body.removeChild(el)
})

test('withProps + withRefs + withContexts chain type-checks', t => {
    const ModeCtx = createContext<number>()
    let propVal:number | undefined
    let refEl:Element | undefined
    new ComponentBuilder('test-chain')
        .withProps((p) => ({ count: p.number() }))
        .withRefs((r) => ({ btn: r.one() }))
        .withContexts(() => ({ mode: ModeCtx }))
        .setup((ctx) => {
            propVal = ctx.props.count()
            refEl = ctx.refs.btn
        })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-chain')
    el.setAttribute('count', '5')
    const btn = document.createElement('button')
    btn.setAttribute('data-ref', 'btn')
    el.appendChild(btn)
    wrapper.appendChild(el)
    provide(wrapper, ModeCtx, 0)
    document.body.appendChild(wrapper)
    t.equal(propVal, 5, 'prop correctly typed and resolved')
    t.ok(refEl === btn, 'ref correctly resolved in full chain')
    document.body.removeChild(wrapper)
})

// US-009: cross-component context tests

test('createContext: returns a token with a symbol id', t => {
    const ctx = createContext<string>()
    t.ok(typeof ctx.id === 'symbol', 'id is a symbol')
})

test('createContext: each token has a unique id', t => {
    const a = createContext<string>()
    const b = createContext<number>()
    t.ok(a.id !== b.id, 'distinct tokens have distinct ids')
})

test('provide + withContexts: value available in ctx.contexts', t => {
    const ThemeCtx = createContext<string>()
    let captured:string | undefined

    define('test-ctx009-provide')
        .withContexts(() => ({ theme: ThemeCtx }))
        .setup((ctx) => { captured = ctx.contexts.theme as string | undefined })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-ctx009-provide')
    wrapper.appendChild(el)
    provide(wrapper, ThemeCtx, 'dark')
    document.body.appendChild(wrapper)

    t.equal(captured, 'dark', 'context value available in ctx.contexts')
    document.body.removeChild(wrapper)
})

test('deferred setup: setup waits until context resolves', t => {
    const CountCtx = createContext<number>()
    let setupRan = false

    define('test-ctx009-deferred')
        .withContexts(() => ({ count: CountCtx }))
        .setup(() => { setupRan = true })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-ctx009-deferred')
    wrapper.appendChild(el)
    document.body.appendChild(wrapper)

    t.ok(!setupRan, 'setup not called before context provided')

    provide(wrapper, CountCtx, 42)
    t.ok(setupRan, 'setup called after context provided')

    document.body.removeChild(wrapper)
})

test('context reactivity: effect re-runs when context value changes', t => {
    const ValCtx = createContext<number>()
    let effectRuns = 0
    let lastVal:number | undefined

    define('test-ctx009-reactive')
        .withContexts(() => ({ val: ValCtx }))
        .setup((ctx) => {
            ctx.effect(() => {
                lastVal = ctx.contexts.val as number | undefined
                effectRuns++
            })
        })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-ctx009-reactive')
    wrapper.appendChild(el)
    provide(wrapper, ValCtx, 1)
    document.body.appendChild(wrapper)

    t.equal(lastVal, 1, 'initial value read')
    t.equal(effectRuns, 1, 'effect ran once on setup')

    provide(wrapper, ValCtx, 2)
    t.equal(lastVal, 2, 'effect re-ran on context update')
    t.equal(effectRuns, 2, 'effect ran twice total')

    document.body.removeChild(wrapper)
})

test('ctx.consume: reads optional context value from ancestor', t => {
    const MsgCtx = createContext<string>()
    let consumed:string | undefined

    const El = factory({
        props: {},
        observedAttrNames: [],
        setup: (ctx) => {
            consumed = ctx.consume(MsgCtx)
        },
    })
    customElements.define('test-ctx009-consume', El)

    const wrapper = document.createElement('div')
    const consumer = document.createElement('test-ctx009-consume')
    wrapper.appendChild(consumer)
    provide(wrapper, MsgCtx, 'hello')
    document.body.appendChild(wrapper)

    t.equal(consumed, 'hello', 'ctx.consume reads context from ancestor')
    document.body.removeChild(wrapper)
})

// US-010: render helpers

function makeTemplate (html:string):HTMLTemplateElement {
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    return tpl
}

test('render: stamps template into container', t => {
    const container = document.createElement('div')
    const tpl = makeTemplate('<span></span>')

    render(container, tpl, {
        data: { label: 'hi' },
        update: (el, item) => { el.textContent = item.label },
    })

    t.equal(container.children.length, 1, 'one child after render')
})

test('render: calling render again with same template reuses element', t => {
    const container = document.createElement('div')
    const tpl = makeTemplate('<span></span>')

    render<{ v:number }>(container, tpl, {
        data: { v: 1 },
        update: (el, item) => { (el as HTMLElement).dataset.v = String(item.v) },
    })
    const first = container.firstElementChild

    render<{ v:number }>(container, tpl, {
        data: { v: 2 },
        update: (el, item) => { (el as HTMLElement).dataset.v = String(item.v) },
    })
    const second = container.firstElementChild

    t.equal(first, second, 'same element reused across renders')
    t.equal(container.children.length, 1, 'still one child')
})

test('render: works with no options', t => {
    const container = document.createElement('div')
    const tpl = makeTemplate('<li></li>')
    render(container, tpl)
    t.equal(container.children.length, 1, 'one child with no options')
})

test('renderList: renders items from data array', t => {
    const container = document.createElement('ul')
    const tpl = makeTemplate('<li></li>')
    const data = [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
    ]

    renderList(container, tpl, {
        data,
        key: item => item.id,
        update: (el, item) => { el.textContent = item.name },
    })

    t.equal(container.children.length, 2, 'two children for two items')
})

test('renderList: removes items no longer in data', t => {
    const container = document.createElement('ul')
    const tpl = makeTemplate('<li></li>')

    renderList(container, tpl, {
        data: [{ id: 'a' }, { id: 'b' }],
        key: item => item.id,
        update: () => {},
    })
    t.equal(container.children.length, 2, 'two children initially')

    renderList(container, tpl, {
        data: [{ id: 'a' }],
        key: item => item.id,
        update: () => {},
    })
    t.equal(container.children.length, 1, 'one child after removal')
})

test('renderList: reuses existing elements by key', t => {
    const container = document.createElement('ul')
    const tpl = makeTemplate('<li></li>')

    renderList(container, tpl, {
        data: [{ id: 'a' }],
        key: item => item.id,
        update: () => {},
    })
    const firstEl = container.firstElementChild

    renderList(container, tpl, {
        data: [{ id: 'a' }],
        key: item => item.id,
        update: () => {},
    })
    const secondEl = container.firstElementChild

    t.equal(firstEl, secondEl, 'same DOM element reused for same key')
})

// US-012: Attribute hydration and refs tests

test('attribute hydration: props initialized from attributes on connect', t => {
    let capturedStr:string | undefined
    let capturedNum:number | undefined
    let capturedBool:boolean | undefined

    define('test-us012-hydrate')
        .withProps((p) => ({
            name: p.string(),
            count: p.number(),
            active: p.boolean(),
        }))
        .setup((ctx) => {
            capturedStr = ctx.props.name()
            capturedNum = ctx.props.count()
            capturedBool = ctx.props.active()
        })

    const el = document.createElement('test-us012-hydrate')
    el.setAttribute('name', 'microtags')
    el.setAttribute('count', '3')
    el.setAttribute('active', '')
    document.body.appendChild(el)

    t.equal(capturedStr, 'microtags', 'string prop hydrated from attribute')
    t.equal(capturedNum, 3, 'number prop hydrated from attribute')
    t.equal(capturedBool, true, 'boolean prop hydrated from attribute presence')

    document.body.removeChild(el)
})

test('attributeChangedCallback: updates prop signal on attribute change', t => {
    let effectRuns = 0
    let lastVal:number | undefined

    define('test-us012-attr-change')
        .withProps((p) => ({ score: p.number() }))
        .setup((ctx) => {
            ctx.effect(() => {
                lastVal = ctx.props.score()
                effectRuns++
            })
        })

    const el = document.createElement('test-us012-attr-change')
    el.setAttribute('score', '10')
    document.body.appendChild(el)

    t.equal(lastVal, 10, 'initial value hydrated from attribute')
    t.equal(effectRuns, 1, 'effect ran once on connect')

    el.setAttribute('score', '20')
    t.equal(lastVal, 20, 'prop signal updated by attributeChangedCallback')
    t.equal(effectRuns, 2, 'effect re-ran after attribute change')

    el.setAttribute('score', '30')
    t.equal(lastVal, 30, 'second attribute change also updates signal')
    t.equal(effectRuns, 3, 'effect ran three times total')

    document.body.removeChild(el)
})

test('refs: r.one resolves single and r.all resolves multiple via define()', t => {
    let capturedOne:Element | undefined
    let capturedAll:Element[] | undefined

    define('test-us012-refs')
        .withRefs((r) => ({ header: r.one(), items: r.all() }))
        .setup((ctx) => {
            capturedOne = ctx.refs.header
            capturedAll = ctx.refs.items
        })

    const el = document.createElement('test-us012-refs')
    const hdr = document.createElement('h1')
    hdr.setAttribute('data-ref', 'header')
    const li1 = document.createElement('li')
    li1.setAttribute('data-ref', 'items')
    const li2 = document.createElement('li')
    li2.setAttribute('data-ref', 'items')
    el.appendChild(hdr)
    el.appendChild(li1)
    el.appendChild(li2)
    document.body.appendChild(el)

    t.ok(capturedOne === hdr, 'r.one resolves to matching element')
    t.ok(Array.isArray(capturedAll), 'r.all returns an array')
    t.equal(capturedAll?.length, 2, 'r.all finds both matching elements')
    t.ok(capturedAll?.[0] === li1, 'first r.all element matches')
    t.ok(capturedAll?.[1] === li2, 'second r.all element matches')

    document.body.removeChild(el)
})

// US-013: Context provide/consume and deferred-setup tests

test('context: ctx.consume reads provided value from ancestor element', t => {
    const LangCtx = createContext<string>()
    let consumed:string | undefined

    define('test-us013-consume')
        .setup((ctx) => { consumed = ctx.consume(LangCtx) })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-us013-consume')
    wrapper.appendChild(el)
    provide(wrapper, LangCtx, 'en')
    document.body.appendChild(wrapper)

    t.equal(consumed, 'en', 'ctx.consume reads context value from ancestor')
    document.body.removeChild(wrapper)
})

test('context: deferred setup waits for ALL required contexts', t => {
    const ACtx = createContext<number>()
    const BCtx = createContext<string>()
    let setupRan = false

    define('test-us013-two-ctx')
        .withContexts(() => ({ a: ACtx, b: BCtx }))
        .setup(() => { setupRan = true })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-us013-two-ctx')
    wrapper.appendChild(el)
    document.body.appendChild(wrapper)

    t.ok(!setupRan, 'setup not called with no contexts provided')

    provide(wrapper, ACtx, 1)
    t.ok(!setupRan, 'setup not called when only first context provided')

    provide(wrapper, BCtx, 'hello')
    t.ok(setupRan, 'setup runs only after both contexts are provided')

    document.body.removeChild(wrapper)
})

test('context: consumer effect re-runs when context value changes', t => {
    const CountCtx = createContext<number>()
    let effectRuns = 0
    let lastVal:number | undefined

    define('test-us013-reactive')
        .withContexts(() => ({ count: CountCtx }))
        .setup((ctx) => {
            ctx.effect(() => {
                lastVal = ctx.contexts.count as number | undefined
                effectRuns++
            })
        })

    const wrapper = document.createElement('div')
    const el = document.createElement('test-us013-reactive')
    wrapper.appendChild(el)
    provide(wrapper, CountCtx, 10)
    document.body.appendChild(wrapper)

    t.equal(lastVal, 10, 'initial context value read by effect')
    t.equal(effectRuns, 1, 'effect ran once on setup')

    provide(wrapper, CountCtx, 20)
    t.equal(lastVal, 20, 'effect re-ran on context value change')
    t.equal(effectRuns, 2, 'effect ran twice total')

    provide(wrapper, CountCtx, 30)
    t.equal(lastVal, 30, 'effect re-ran on second value change')
    t.equal(effectRuns, 3, 'effect ran three times total')

    document.body.removeChild(wrapper)
})

// US-014: Untracked-read and cleanup tests

test('untracked: reading inside ctx.effect does not create subscription', t => {
    const external = signal(0)
    let effectRuns = 0

    define('test-us014-untracked')
        .setup((ctx) => {
            ctx.effect(() => {
                effectRuns++
                untracked(() => external())
            })
        })

    const el = document.createElement('test-us014-untracked')
    document.body.appendChild(el)

    t.equal(effectRuns, 1, 'effect runs once on setup')
    external(1)
    t.equal(effectRuns, 1, 'effect did not re-run after untracked read')
    external(2)
    t.equal(effectRuns, 1, 'still no re-run on second change')

    document.body.removeChild(el)
})

test('cleanup: ctx.on listener removed on disconnect', async t => {
    let clickCount = 0

    define('test-us014-on-cleanup')
        .setup((ctx) => {
            ctx.on(ctx.host, 'click', () => { clickCount++ })
        })

    const el = document.createElement('test-us014-on-cleanup')
    document.body.appendChild(el)
    el.click()
    t.equal(clickCount, 1, 'listener fires before disconnect')
    document.body.removeChild(el)
    await Promise.resolve()
    el.click()
    t.equal(clickCount, 1, 'listener not called after disconnect')
})

test('cleanup: ctx.effect disposed on disconnect', async t => {
    const external = signal(0)
    let effectRuns = 0

    define('test-us014-effect-cleanup')
        .setup((ctx) => {
            ctx.effect(() => {
                external()
                effectRuns++
            })
        })

    const el = document.createElement('test-us014-effect-cleanup')
    document.body.appendChild(el)
    t.equal(effectRuns, 1, 'effect ran on connect')
    external(1)
    t.equal(effectRuns, 2, 'effect ran after signal change')
    document.body.removeChild(el)
    await Promise.resolve()
    external(2)
    t.equal(effectRuns, 2, 'effect did not run after disconnect')
})

test('cleanup: ctx.bind stops updating DOM property on disconnect', async t => {
    const label = signal('initial')

    define('test-us014-bind-cleanup')
        .setup((ctx) => {
            const span = document.createElement('span')
            ctx.host.appendChild(span)
            ctx.bind(label, span, { prop: 'title' })
        })

    const el = document.createElement('test-us014-bind-cleanup')
    document.body.appendChild(el)
    const span = el.querySelector('span') as HTMLElement
    t.equal(span.title, 'initial', 'binding active on connect')
    label('updated')
    t.equal(span.title, 'updated', 'binding updates on signal change')
    document.body.removeChild(el)
    await Promise.resolve()
    label('after-disconnect')
    t.equal(span.title, 'updated', 'binding stopped after disconnect')
})

test('cleanup: ctx.onCleanup callback runs on disconnect', async t => {
    let cleanupRan = false

    define('test-us014-oncleanup')
        .setup((ctx) => {
            ctx.onCleanup(() => { cleanupRan = true })
        })

    const el = document.createElement('test-us014-oncleanup')
    document.body.appendChild(el)
    t.ok(!cleanupRan, 'cleanup not called before disconnect')
    document.body.removeChild(el)
    await Promise.resolve()
    t.ok(cleanupRan, 'cleanup called on disconnect')
})

test('cleanup: throwing cleanup - remaining run, first error re-throws', t => {
    let secondRan = false
    let thirdRan = false

    define('test-us014-throw-cleanup')
        .setup((ctx) => {
            ctx.onCleanup(() => { throw new Error('first-throws') })
            ctx.onCleanup(() => { secondRan = true })
            ctx.onCleanup(() => { thirdRan = true })
        })

    const el = document.createElement('test-us014-throw-cleanup')
    document.body.appendChild(el)

    const caught = catchTeardown(() => document.body.removeChild(el))

    t.ok(secondRan, 'second cleanup ran despite first throwing')
    t.ok(thirdRan, 'third cleanup ran despite first throwing')
    t.ok(caught !== null, 'error was re-thrown')
    t.equal(caught?.message, 'first-throws', 'correct error re-thrown')
})

test('renderList: skips update when data item is unchanged', t => {
    const container = document.createElement('ul')
    const tpl = makeTemplate('<li></li>')
    const item = { id: 'x', v: 0 }
    let updateCount = 0

    renderList(container, tpl, {
        data: [item],
        key: i => i.id,
        update: () => { updateCount++ },
    })

    renderList(container, tpl, {
        data: [item],
        key: i => i.id,
        update: () => { updateCount++ },
    })

    t.equal(updateCount, 1, 'update called only once when item is same ref')
})

// Builder .render link: browser hydration tests

test('render: inserting static render output upgrades and runs setup', t => {
    let setupRan = false
    let capturedRef:Element | undefined

    const El = define('test-render-hydrate')
        .withProps(p => ({ count: p.number() }))
        .withRefs(r => ({ display: r.one() }))
        .render(({ props, refs }) => {
            return `<span data-ref="${refs.display}">${props.count}</span>`
        })
        .setup(ctx => {
            setupRan = true
            capturedRef = ctx.refs.display
        })

    const html = El.render({ count: 7 })
    const container = document.createElement('div')
    container.innerHTML = html
    const host = container.firstElementChild as HTMLElement
    document.body.appendChild(host)

    t.ok(setupRan, 'setup ran after inserting rendered markup')
    t.ok(capturedRef instanceof HTMLElement, 'ref resolved')
    t.equal(
        (capturedRef as HTMLElement).getAttribute('data-ref'),
        'display',
        'ref resolved from rendered data-ref attribute'
    )

    document.body.removeChild(host)
})

// html templater tests

test('html: plain tag with attributes and text', t => {
    const result = String(html`<div class="box" id="main">hello</div>`)
    t.equal(typeof result, 'string', 'returns a string')
    const doc = parse(result)
    const div = doc.querySelector('div')
    t.ok(div, 'parsed to a div')
    t.equal(div!.getAttribute('class'), 'box', 'class attr')
    t.equal(div!.getAttribute('id'), 'main', 'id attr')
    t.equal(div!.textContent, 'hello', 'text content')
})

test('html: escapes interpolated strings', t => {
    const danger = '<script>"alert(\'xss\')&</script>'
    const result = String(html`<span>${danger}</span>`)
    t.ok(!result.includes('<script>'), 'no raw <script> in output')
    const doc = parse(result)
    const span = doc.querySelector('span')
    t.equal(span!.textContent, danger, 'text content equals original value')
})

test('html: raw passes through as markup', t => {
    const markup = '<em>bold</em>'
    const result = String(html`<div>${raw(markup)}</div>`)
    const doc = parse(result)
    const em = doc.querySelector('em')
    t.ok(em, 'raw markup parsed as element')
    t.equal(em!.textContent, 'bold', 'inner text')
})

test('html: element class as tag calls static render', t => {
    const El = define('html-test-comp')
        .withProps(p => ({
            count: p.number(),
            label: p.string(),
        }))
        .render(({ props }) => {
            return `<span>${props.count}</span>`
        })
        .setup(() => {})

    const result = String(html`<${El} count=${5} label="hi" class="extra" />`)
    const doc = parse(result)
    const host = doc.querySelector('html-test-comp')

    t.ok(host, 'host element present')
    t.equal(
        host!.getAttribute('count'),
        '5',
        'declared prop serialized as attribute'
    )
    t.equal(
        host!.getAttribute('class'),
        'extra',
        'undeclared prop passed as attr'
    )
    const span = host!.querySelector('span')
    t.ok(span, 'render output present inside host')
})

test('html: nested components not double-escaped', t => {
    const Inner = define('html-test-inner')
        .withProps(p => ({ text: p.string() }))
        .render(({ props }) => {
            return `<b>${props.text}</b>`
        })
        .setup(() => {})

    const Outer = define('html-test-outer')
        .render(({ children }) => {
            return `<div>${children}</div>`
        })
        .setup(() => {})

    const result = String(html`<${Outer}><${Inner} text="a&b" /></${Outer}>`)
    const doc = parse(result)
    const inner = doc.querySelector('html-test-inner')
    t.ok(inner, 'inner component rendered')
    const b = inner!.querySelector('b')
    t.ok(b, 'inner render output present')
    t.ok(b?.textContent.includes('a&b'),
        'inner child component should be expanded')
})

test('html: void elements emit no closing tag', t => {
    const result = String(html`<input type="text" />`)
    t.ok(!result.includes('</input>'), 'no closing input tag')
    const result2 = String(html`<div>hi</div>`)
    t.ok(result2.includes('</div>'), 'non-void has closing tag')
})

test('browser html: an unclosed void element with children throws',
    async t => {
        await t.throws(
            () => bhtml`<form><input type="text"><b>go</b></form>`,
            /input/,
            'error names the tag'
        )
    })

test('mount: self-closed void elements are created', t => {
    const box = document.createElement('div')
    mount(box, bhtml`<form><input type="text" /><br /><b>go</b></form>`)
    const form = box.querySelector('form')!
    t.ok(form.querySelector('input'), 'input created')
    t.ok(form.querySelector('br'), 'br created')
    t.ok(form.querySelector('b'), 'following element kept')
    t.equal(form.querySelector('input')!.childNodes.length, 0,
        'input has no children')
})

test('html: array children from map', t => {
    const items = ['a', 'b', 'c']
    const result = String(html`<ul>${
        items.map(i => html`<li>${i}</li>`)
    }</ul>`)
    const doc = parse(result)
    const lis = doc.querySelectorAll('li')
    t.equal(lis.length, 3, 'one li per item')
    t.equal(lis[0].textContent, 'a', 'first item')
    t.equal(lis[1].textContent, 'b', 'second item')
    t.equal(lis[2].textContent, 'c', 'third item')
})

test('html: inserting output upgrades defined components', t => {
    let setupRan = false
    const El = define('html-test-upgrade')
        .withProps(p => ({ n: p.number() }))
        .render(({ props }) => `<b>${props.n}</b>`)
        .setup(() => { setupRan = true })

    const result = String(html`<${El} n=${42} />`)
    const container = document.createElement('div')
    container.innerHTML = result
    const host = container.firstElementChild as HTMLElement
    document.body.appendChild(host)

    t.ok(setupRan, 'setup ran after inserting html output')
    document.body.removeChild(host)
})

test('html: String() and interpolation yield plain markup', t => {
    const result = String(html`<span>ok</span>`)
    const str = String(result)
    t.ok(
        !str.includes('_Trusted'),
        'no marker class name in stringified output'
    )
    t.ok(
        !str.includes('[object'),
        'no [object in stringified output'
    )
    const interp = `prefix ${result} suffix`
    t.ok(
        interp.startsWith('prefix <span>'),
        'interpolation yields clean markup'
    )
})

// Prop accessors on hosts

test('prop accessor: reading host.<prop> returns the current value', t => {
    const El = define('test-accessor-read')
        .withProps(p => ({ count: p.number() }))
        .setup(() => {})
    const el = new El()
    el.setAttribute('count', '3')
    document.body.appendChild(el)
    t.equal(el.count, 3, 'reads the hydrated value')
    el.setAttribute('count', '4')
    t.equal(el.count, 4, 'reads the value after an attribute change')
    document.body.removeChild(el)
})

test('prop accessor: assigning a value updates the setup signal', t => {
    const seen:number[] = []
    const El = define('test-accessor-write')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => {
            ctx.effect(() => { seen.push(ctx.props.count()) })
        })
    const el = new El()
    el.setAttribute('count', '1')
    document.body.appendChild(el)
    el.count = 7
    t.deepEqual(seen, [1, 7], 'effect re-ran with the assigned value')
    t.equal(el.count, 7, 'reads the assigned value')
    document.body.removeChild(el)
})

test('prop accessor: assigning a signal makes the prop follow it', t => {
    const seen:string[] = []
    const El = define('test-accessor-signal')
        .withProps(p => ({ label: p.string() }))
        .setup(ctx => {
            ctx.effect(() => { seen.push(ctx.props.label()) })
        })
    const el = new El()
    document.body.appendChild(el)
    const src = signal('a')
    ;(el as any).label = src
    t.equal(el.label, 'a', 'reads through to the signal')
    src('b')
    t.equal(el.label, 'b', 'follows later signal writes')
    t.deepEqual(seen.slice(-2), ['a', 'b'], 'setup effect tracks it')
    el.setAttribute('label', 'ignored')
    t.equal(el.label, 'b', 'attribute does not override a bound signal')
    el.label = 'plain'
    t.equal(el.label, 'plain', 'a plain value replaces the binding')
    src('c')
    t.equal(el.label, 'plain', 'old signal no longer drives the prop')
    document.body.removeChild(el)
})

test('bindProp: the host prop reads and tracks the signal', t => {
    const seen:number[] = []
    const El = define('test-bind-prop')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => {
            ctx.effect(() => { seen.push(ctx.props.count()) })
        })
    const el = new El()
    document.body.appendChild(el)
    const base = signal(2)
    bindProp(el, 'count', computed(() => base() * 10))
    t.equal(el.count, 20, 'reads the bound value')
    base(3)
    t.equal(el.count, 30, 'follows later changes')
    t.deepEqual(seen.slice(-2), [20, 30], 'setup effect tracks it')
    document.body.removeChild(el)
})

test('prop accessor: writing a bound prop in setup throws', t => {
    let write:((v:number) => void)|undefined
    const El = define('test-accessor-readonly')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => { write = v => ctx.props.count(v) })
    const el = new El()
    document.body.appendChild(el)
    const src = signal(1)
    ;(el as any).count = src
    let err:unknown
    try { write!(5) } catch (e) { err = e }
    t.ok(err instanceof Error, 'the write throws')
    const msg = String((err as Error)?.message).toLowerCase()
    t.ok(msg.includes('test-accessor-readonly'), 'message names the tag')
    t.ok(msg.includes('count'), 'message names the prop')
    t.equal(src(), 1, 'the bound signal keeps its value')
    t.equal(el.count, 1, 'the prop still reads the bound value')
    document.body.removeChild(el)
})

test('prop accessor: writing a prop bound to a computed throws', t => {
    let write:((v:number) => void)|undefined
    const El = define('test-accessor-computed')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => { write = v => ctx.props.count(v) })
    const el = new El()
    document.body.appendChild(el)
    const base = signal(2)
    ;(el as any).count = computed(() => base() * 10)
    let err:unknown
    try { write!(5) } catch (e) { err = e }
    t.ok(err instanceof Error, 'the write throws, not silently dropped')
    t.equal(el.count, 20, 'the prop still reads the computed')
    document.body.removeChild(el)
})

test('prop accessor: an unbound prop is writable by its setup', t => {
    let write:((v:number) => void)|undefined
    const El = define('test-accessor-unbound')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => { write = v => ctx.props.count(v) })
    const el = new El()
    el.setAttribute('count', '1')
    document.body.appendChild(el)
    write!(9)
    t.equal(el.count, 9, 'the setup write is visible on the host')
    document.body.removeChild(el)
})

test('prop accessor: a new signal from outside replaces the binding', t => {
    const seen:number[] = []
    const El = define('test-accessor-rebind')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => {
            ctx.effect(() => { seen.push(ctx.props.count()) })
        })
    const el = new El()
    document.body.appendChild(el)
    const a = signal(1)
    const b = signal(100)
    ;(el as any).count = a
    ;(el as any).count = b
    t.equal(el.count, 100, 'reads the new signal')
    a(2)
    t.equal(el.count, 100, 'the old signal no longer drives the prop')
    b(101)
    t.equal(seen[seen.length - 1], 101, 'setup sees the new signal')
    document.body.removeChild(el)
})

test('prop accessor: pre-upgrade assignments are picked up', t => {
    const a = document.createElement('test-accessor-pre') as any
    const b = document.createElement('test-accessor-pre') as any
    const src = signal(10)
    a.count = 5
    b.count = src
    document.body.appendChild(a)
    document.body.appendChild(b)
    const seen:number[] = []
    define('test-accessor-pre')
        .withProps(p => ({ count: p.number() }))
        .setup(ctx => {
            ctx.effect(() => { seen.push(ctx.props.count()) })
        })
    t.equal(a.count, 5, 'plain value picked up at upgrade')
    t.equal(b.count, 10, 'signal picked up at upgrade')
    src(11)
    t.equal(b.count, 11, 'upgraded host follows the signal')
    t.ok(seen.includes(5) && seen.includes(11), 'setup saw both values')
    document.body.removeChild(a)
    document.body.removeChild(b)
})

// Browser templater: mount into an empty container

test('mount: creates elements, including a kept host that upgrades', t => {
    let ran = false
    const Kept = define('test-mount-kept')
        .withProps(p => ({ label: p.string() }))
        .withRefs(r => ({ text: r.one() }))
        .render(({ props }) => bhtml`<b data-ref="text">${props.label}</b>`)
        .setup(() => { ran = true })
    const box = document.createElement('div')
    document.body.appendChild(box)
    mount(box, bhtml`<section><p class="x">hi</p><${Kept} label="a" /></section>`)
    const section = box.firstElementChild!
    t.equal(section.tagName, 'SECTION', 'creates the outer element')
    t.ok(section.querySelector('p.x'), 'creates the nested element')
    const host = section.querySelector(Kept.TAG) as any
    t.ok(host instanceof Kept, 'host is upgraded')
    t.ok(host.querySelector('[data-ref="text"]'), 'host has its markup')
    t.ok(ran, 'host setup ran')
    t.equal(host.label, 'a', 'host prop is set')
    box.remove()
})

test('mount: creating a host registers render support', t => {
    // This suite also imports the server templater, which registers the
    // support module (ADR-009), so clear the registry symbol first.
    const key = Symbol.for('microtags.render')
    const g = globalThis as Record<symbol, unknown>
    const saved = g[key]
    delete g[key]
    try {
        const Kept = define('test-mount-registers')
            .withProps(p => ({ n: p.number() }))
            .render(({ props }) => bhtml`<i>${props.n}</i>`)
            .setup(() => {})
        const box = document.createElement('div')
        mount(box, bhtml`<${Kept} n=${1} />`)
        t.ok(box.querySelector(Kept.TAG + ' i'), 'host was created')
        t.equal(typeof Kept.render({ n: 2 }), 'string',
            'render works with no separate support import')
    } catch (err) {
        t.fail('threw: ' + (err as Error).message)
    } finally {
        g[key] = saved
    }
})

test('mount: markup from another package copy creates elements', t => {
    // `microtags/htm` resolves to dist, a second copy of the templater
    const box = document.createElement('div')
    document.body.appendChild(box)
    const dispose = mount(box, dhtml`<section><p class="x">hi</p></section>`)
    const section = box.firstElementChild
    t.equal(section?.tagName, 'SECTION', 'creates the outer element')
    t.ok(section?.querySelector('p.x'), 'creates the nested element')
    t.equal(box.querySelectorAll('*').length, 2, 'no escaped text in place')
    dispose()
    box.remove()
})

test('mount: another copy\'s markup nested in a template', t => {
    const box = document.createElement('div')
    document.body.appendChild(box)
    const dispose = mount(box, bhtml`<div>${dhtml`<i>a</i>`}${
        draw('<b>b</b>')
    }</div>`)
    t.ok(box.querySelector('div > i'), 'nested markup is an element')
    t.ok(box.querySelector('div > b'), 'nested raw is an element')
    dispose()
    box.remove()
})

test('String(): another copy\'s markup is not escaped', t => {
    const tpl = document.createElement('template')
    tpl.innerHTML = String(bhtml`<div>${dhtml`<i>a</i>`}</div>`)
    t.ok(tpl.content.querySelector('div > i'), 'nested markup is HTML')
})

test('mount: a signal component prop updates the host', t => {
    const seen:string[] = []
    const Kept = define('test-mount-sigprop')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<i></i>`)
        .setup(ctx => { ctx.effect(() => { seen.push(ctx.props.label()) }) })
    const box = document.createElement('div')
    document.body.appendChild(box)
    const label = signal('one')
    mount(box, bhtml`<${Kept} label=${label} />`)
    const host = box.firstElementChild as any
    t.equal(host.label, 'one', 'reads the signal value')
    label('two')
    t.equal(host.label, 'two', 'follows the signal')
    t.equal(seen[seen.length - 1], 'two', 'setup effect saw the change')
    box.remove()
})

test('mount: a signal attribute updates; false/null/undefined remove', t => {
    const box = document.createElement('div')
    const v = signal<unknown>('a')
    const fnVal = signal(1)
    mount(box, bhtml`<p title=${v} data-n=${() => fnVal() * 2}></p>`)
    const p = box.firstElementChild!
    t.equal(p.getAttribute('title'), 'a', 'initial value')
    v('b')
    t.equal(p.getAttribute('title'), 'b', 'updated')
    fnVal(4)
    t.equal(p.getAttribute('data-n'), '8', 'function attribute updates')
    for (const off of [false, null, undefined]) {
        v('back')
        v(off)
        t.ok(!p.hasAttribute('title'), `${off} removes the attribute`)
    }
})

test('mount: on<event> listeners on a plain element and a host', t => {
    const Kept = define('test-mount-evhost')
        .render(() => bhtml`<i></i>`)
        .setup(() => {})
    const box = document.createElement('div')
    let clicks = 0
    let pings = 0
    mount(box, bhtml`<div>
        <button onclick=${() => clicks++}>x</button>
        <${Kept} onping=${() => pings++} />
    </div>`)
    box.querySelector('button')!.click()
    box.querySelector(Kept.TAG)!.dispatchEvent(new CustomEvent('ping'))
    t.equal(clicks, 1, 'plain element listener fired')
    t.equal(pings, 1, 'host listener fired')
})

test('mount: dispose stops updates and listeners, keeps the DOM', t => {
    const box = document.createElement('div')
    const v = signal('a')
    let clicks = 0
    const dispose = mount(
        box,
        bhtml`<button title=${v} onclick=${() => clicks++}>x</button>`
    )
    const btn = box.firstElementChild as HTMLButtonElement
    dispose()
    v('b')
    btn.click()
    t.equal(btn.getAttribute('title'), 'a', 'attribute no longer updates')
    t.equal(clicks, 0, 'listener no longer fires')
    t.equal(box.firstElementChild, btn, 'node still in the container')
})

test('mount: mounting twice on one container throws', t => {
    const box = document.createElement('div')
    mount(box, bhtml`<p></p>`)
    t.throws(() => mount(box, bhtml`<p></p>`), 'second mount throws')
})

test('mount: creating a component with no render link throws', t => {
    const Stripped = define('test-mount-stripped').setup(() => {})
    const box = document.createElement('div')
    try {
        mount(box, bhtml`<${Stripped} />`)
        t.fail('should throw')
    } catch (err) {
        t.ok(String(err).includes(Stripped.TAG), 'error names the tag')
    }
})

// Browser templater: reactive regions and reconciliation

test('region: a conditional adds and removes its content', t => {
    const box = document.createElement('div')
    const open = signal(false)
    mount(box, bhtml`<div>${() => open() && bhtml`<p class="c">x</p>`}</div>`)
    t.equal(box.querySelectorAll('p.c').length, 0, 'absent when falsy')
    open(true)
    t.equal(box.querySelectorAll('p.c').length, 1, 'added when truthy')
    open(false)
    t.equal(box.querySelectorAll('p.c').length, 0, 'removed when falsy')
})

test('region: plain text updates without replacing neighbours', t => {
    const box = document.createElement('div')
    const n = signal(1)
    mount(box, bhtml`<p><b>a</b>${n}<i>b</i></p>`)
    const p = box.firstElementChild!
    const b = p.querySelector('b')
    const i = p.querySelector('i')
    const textNode = Array.from(p.childNodes)
        .find(x => x.nodeType === Node.TEXT_NODE)
    n(2)
    t.equal(p.querySelector('b'), b, 'node before is kept')
    t.equal(p.querySelector('i'), i, 'node after is kept')
    const after = Array.from(p.childNodes)
        .find(x => x.nodeType === Node.TEXT_NODE)
    t.equal(after, textNode, 'text node is patched in place')
    t.equal(after!.textContent, '2', 'text follows the signal')
})

function keyedList (box:Element, items:ReturnType<typeof signal<string[]>>) {
    mount(box, bhtml`<ul>${() => items().map(k =>
        bhtml`<li key=${k}>${k}</li>`
    )}</ul>`)
    return () => Array.from(box.querySelectorAll('li'))
}

test('region: reordering a keyed list moves the same nodes', t => {
    const box = document.createElement('div')
    const items = signal(['a', 'b', 'c'])
    const lis = keyedList(box, items)
    const [a, b, c] = lis()
    items(['c', 'a', 'b'])
    const now = lis()
    t.equal(now.length, 3, 'same number of items')
    t.equal(now[0], c, 'c moved to the front')
    t.equal(now[1], a, 'a is the same node')
    t.equal(now[2], b, 'b is the same node')
})

test('region: adding and removing keyed items touches only those', t => {
    const box = document.createElement('div')
    const items = signal(['a', 'b', 'c'])
    const lis = keyedList(box, items)
    const [a, , c] = lis()
    items(['a', 'c', 'd'])
    const now = lis()
    t.equal(now.length, 3, 'one removed, one added')
    t.equal(now[0], a, 'a kept')
    t.equal(now[1], c, 'c kept')
    t.equal(now[2].getAttribute('key'), 'd', 'd created')
    t.ok(!now.some(x => x.getAttribute('key') === 'b'), 'b removed')
})

test('region: a host in a keyed list keeps identity on reorder', t => {
    let setups = 0
    const Item = define('test-region-keyed-host')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<span></span>`)
        .setup(() => { setups++ })
    const box = document.createElement('div')
    document.body.appendChild(box)
    const items = signal(['a', 'b'])
    mount(box, bhtml`<div>${() => items().map(k =>
        bhtml`<${Item} key=${k} label=${k} />`
    )}</div>`)
    const [a, b] = Array.from(box.querySelectorAll(Item.TAG))
    const before = setups
    items(['b', 'a'])
    const now = Array.from(box.querySelectorAll(Item.TAG))
    t.equal(now[0], b, 'b host is the same node')
    t.equal(now[1], a, 'a host is the same node')
    t.equal(setups, before, 'no host was set up again')
    box.remove()
})

test('region: without moveBefore, a reorder keeps host state', async t => {
    let setups = 0
    const states:ReturnType<typeof signal<number>>[] = []
    const Item = define('test-region-insert-move')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<span></span>`)
        .setup(() => {
            setups++
            states.push(signal(states.length))
        })
    const box = document.createElement('div')
    document.body.appendChild(box)
    const items = signal(['a', 'b', 'c'])
    mount(box, bhtml`<div>${() => items().map(k =>
        bhtml`<${Item} key=${k} label=${k} />`
    )}</div>`)
    // force the insertBefore fallback, as in browsers with no moveBefore
    ;(box.firstElementChild as any).moveBefore = undefined
    states[0](10)
    items(['c', 'a', 'b'])
    await Promise.resolve()
    t.equal(setups, 3, 'setup ran once per host')
    t.equal(states[0](), 10, 'state from setup survived the reorder')
    box.remove()
})

test('region: duplicate keys in one region throw naming the key', t => {
    const box = document.createElement('div')
    let caught:Error | null = null
    try {
        keyedList(box, signal(['a', 'dup-key', 'dup-key']))
    } catch (err) {
        caught = err as Error
    }
    t.ok(caught, 'mount throws')
    t.ok(caught?.message.includes('dup-key'), 'message names the key')
})

test('region: duplicate keys introduced by an update throw', t => {
    const box = document.createElement('div')
    const items = signal(['a', 'b'])
    keyedList(box, items)
    let caught:Error | null = null
    try {
        items(['a', 'later-dup', 'later-dup'])
    } catch (err) {
        caught = err as Error
    }
    t.ok(caught?.message.includes('later-dup'), 'message names the key')
})

function reorderWith (
    moveBefore:unknown
):{ before:HTMLLIElement[], after:HTMLLIElement[] } {
    const box = document.createElement('div')
    document.body.appendChild(box)
    const items = signal(['a', 'b', 'c'])
    const lis = keyedList(box, items)
    const ul = box.querySelector('ul')!
    Object.defineProperty(ul, 'moveBefore', {
        value: moveBefore,
        configurable: true,
    })
    const before = lis()
    items(['c', 'a', 'b'])
    const after = lis()
    box.remove()
    return { before, after }
}

test('region: a throwing moveBefore falls back to insertBefore', t => {
    const { before: [a, b, c], after } = reorderWith(() => {
        throw new Error('moveBefore failed')
    })
    t.equal(after.length, 3, 'same number of items')
    t.equal(after[0], c, 'c moved to the front')
    t.equal(after[1], a, 'a is second')
    t.equal(after[2], b, 'b is third')
})

test('region: a missing moveBefore falls back to insertBefore', t => {
    const { before: [a, b, c], after } = reorderWith(undefined)
    t.equal(after.length, 3, 'same number of items')
    t.equal(after[0], c, 'c moved to the front')
    t.equal(after[1], a, 'a is second')
    t.equal(after[2], b, 'b is third')
})

test('region: unkeyed same-tag children are patched in place', t => {
    const box = document.createElement('div')
    const cls = signal('one')
    mount(box, bhtml`<div>${() => bhtml`<p class=${cls()}>x</p>`}</div>`)
    const p = box.querySelector('p')
    cls('two')
    t.equal(box.querySelector('p'), p, 'same node')
    t.equal(p!.getAttribute('class'), 'two', 'attribute updated')
})

test('region: a kept host has its props rebound', t => {
    const Kept = define('test-region-rebind')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<i></i>`)
        .setup(() => {})
    const box = document.createElement('div')
    document.body.appendChild(box)
    const label = signal('one')
    mount(box, bhtml`<div>${() => bhtml`<${Kept} label=${label()} />`}</div>`)
    const host = box.querySelector(Kept.TAG) as any
    label('two')
    t.equal(box.querySelector(Kept.TAG), host, 'host is kept')
    t.equal(host.label, 'two', 'prop rebound to the new value')
    box.remove()
})

test('region: host markup untouched, children range updated', t => {
    const Wrap = define('test-region-wrap')
        .render(({ children }) =>
            bhtml`<b class="own">own</b>${braw(children)}`)
        .setup(() => {})
    const box = document.createElement('div')
    document.body.appendChild(box)
    const n = signal(1)
    mount(box, bhtml`<div>${() =>
        bhtml`<${Wrap}><p class="in" data-n=${n()}>in</p></${Wrap}>`
    }</div>`)
    const host = box.querySelector(Wrap.TAG)!
    const own = host.querySelector('b.own')!
    own.setAttribute('data-touched', '')
    const inner = host.querySelector('p.in')!
    n(2)
    t.equal(box.querySelector(Wrap.TAG), host, 'host kept')
    t.equal(host.querySelector('b.own'), own, 'own markup node kept')
    t.ok(own.hasAttribute('data-touched'), 'own markup not reconciled')
    t.equal(host.querySelector('p.in'), inner, 'child patched in place')
    t.equal(inner.getAttribute('data-n'), '2', 'children range updated')
    box.remove()
})

test('region: dispose stops region updates', t => {
    const box = document.createElement('div')
    const open = signal(false)
    const dispose = mount(
        box,
        bhtml`<div>${() => open() && bhtml`<p></p>`}</div>`
    )
    dispose()
    open(true)
    t.equal(box.querySelectorAll('p').length, 0, 'region did not update')
})

// Browser templater: form controls bind DOM properties

test('controls: a bound value is a property, not an attribute', t => {
    const box = document.createElement('div')
    const v = signal('hello')
    mount(box, bhtml`<div><input value=${v} /><textarea value=${v} />
        </div>`)
    const input = box.querySelector('input')!
    const area = box.querySelector('textarea')!
    t.equal(input.value, 'hello', 'input shows the bound value')
    t.equal(area.value, 'hello', 'textarea shows the bound value')
    t.ok(!input.hasAttribute('value'), 'no value attribute on the input')
    v('bye')
    t.equal(input.value, 'bye', 'input follows the signal')
    t.equal(area.value, 'bye', 'textarea follows the signal')
    t.ok(!input.hasAttribute('value'), 'still no value attribute')
})

test('controls: an edit survives a re-render; a new bound value wins', t => {
    const box = document.createElement('div')
    const v = signal('a')
    const other = signal(1)
    mount(box, bhtml`<div>${() => bhtml`<form data-n=${other()}>
        <input value=${v()} /></form>`}</div>`)
    const input = box.querySelector('input')!
    input.value = 'typed'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    other(2)
    t.equal(box.querySelector('input'), input, 'input is kept')
    t.equal(input.value, 'typed', 'unrelated re-render keeps the edit')
    v('b')
    t.equal(input.value, 'b', 'a changed bound value replaces the edit')
})

test('controls: a toggle survives a re-render; a new bound value wins', t => {
    const box = document.createElement('div')
    const on = signal(false)
    const other = signal(1)
    mount(box, bhtml`<div>${() => bhtml`<form data-n=${other()}>
        <input type="checkbox" checked=${on()} /></form>`}</div>`)
    const box1 = box.querySelector('input')!
    t.equal(box1.checked, false, 'starts unchecked')
    box1.click()
    t.equal(box1.checked, true, 'visitor checked it')
    other(2)
    t.equal(box.querySelector('input'), box1, 'checkbox is kept')
    t.equal(box1.checked, true, 'unrelated re-render keeps the toggle')
    on(true)
    on(false)
    t.equal(box1.checked, false, 'a changed bound value replaces it')
})

test('controls: a select created with a bound value selects it', t => {
    const box = document.createElement('div')
    const v = signal('b')
    mount(box, bhtml`<select value=${v}>
        <option value="a">A</option>
        <option value="b">B</option>
        <option value="c">C</option>
    </select>`)
    const select = box.querySelector('select')!
    t.equal(select.value, 'b', 'the matching option is selected')
    t.ok(select.options[1].selected, 'option b is selected')
    v('c')
    t.equal(select.value, 'c', 'select follows the signal')
})

test('controls: null bound to value is an empty string', t => {
    const box = document.createElement('div')
    const v = signal<string | null>('x')
    mount(box, bhtml`<input value=${v} />`)
    const input = box.querySelector('input')!
    v(null)
    t.equal(input.value, '', 'null writes an empty string')
    v('y')
    v(undefined as unknown as null)
    t.equal(input.value, '', 'undefined writes an empty string')
})

test('controls: String() still emits control values as attributes', t => {
    const m = bhtml`<form><input value=${'hi'} />
        <input type="checkbox" checked=${true} />
        <select><option value="a" selected=${true}>A</option></select>
        </form>`
    const doc = parse(String(m))
    const [text, check] = Array.from(doc.querySelectorAll('input'))
    t.equal(text.getAttribute('value'), 'hi', 'value is an attribute')
    t.ok(check.hasAttribute('checked'), 'checked is an attribute')
    t.ok(doc.querySelector('option')!.hasAttribute('selected'),
        'selected is an attribute')
})

// Browser templater: mount adopts server-rendered DOM

function adoptBox (markup:string):HTMLElement {
    const box = document.createElement('div')
    document.body.appendChild(box)
    box.innerHTML = markup
    return box
}

function allNodes (root:Node):Node[] {
    const out:Node[] = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
    let n:Node | null
    while ((n = w.nextNode())) out.push(n)
    return out
}

test('adopt: mounting over existing children creates no nodes', t => {
    const Kept = define('test-adopt-kept')
        .withProps(p => ({ label: p.string() }))
        .render(({ props }) => bhtml`<b data-ref="t">${props.label}</b>`)
        .setup(() => {})
    const box = adoptBox('<section><p class="x">hi</p>' +
        '<test-adopt-kept label="a"><b data-ref="t">a</b>' +
        '</test-adopt-kept><!--[-->1<!--]--></section>')
    const n = signal(1)
    const before = allNodes(box)
    mount(box, bhtml`<section><p class="x">hi</p><${Kept} label="a" />${
        n}</section>`)
    const after = allNodes(box)
    t.equal(after.length, before.length, 'node count unchanged')
    t.ok(before.every((x, i) => after[i] === x), 'every node is the same')
    box.remove()
})

test('adopt: a signal prop updates the adopted host', t => {
    const Kept = define('test-adopt-sigprop')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<i></i>`)
        .setup(() => {})
    const box = adoptBox('<test-adopt-sigprop label="one"><i></i>' +
        '</test-adopt-sigprop>')
    const host = box.firstElementChild as any
    const label = signal('one')
    mount(box, bhtml`<${Kept} label=${label} />`)
    label('two')
    t.equal(box.firstElementChild, host, 'host is the same node')
    t.equal(host.label, 'two', 'host follows the signal')
    box.remove()
})

test('adopt: a bound attribute and a listener work', t => {
    const box = adoptBox('<div><button title="a">go</button></div>')
    const btn = box.querySelector('button')!
    const title = signal('a')
    let clicks = 0
    mount(box, bhtml`<div><button title=${title}
        onclick=${() => { clicks++ }}>go</button></div>`)
    title('b')
    t.equal(btn.getAttribute('title'), 'b', 'attribute is bound')
    btn.click()
    t.equal(clicks, 1, 'listener is attached')
    t.equal(box.querySelector('button'), btn, 'button is the same node')
    box.remove()
})

test('adopt: a conditional region adds and removes content', t => {
    const box = adoptBox('<div><!--[--><p class="c">x</p><!--]--></div>')
    const p = box.querySelector('p.c')
    const open = signal(true)
    mount(box, bhtml`<div>${() =>
        open() && bhtml`<p class="c">x</p>`}</div>`)
    t.equal(box.querySelector('p.c'), p, 'content adopted')
    open(false)
    t.equal(box.querySelector('p.c'), null, 'content removed')
    open(true)
    t.ok(box.querySelector('p.c'), 'content added back')
})

test('adopt: a keyed list of hosts reorders with identity kept', t => {
    const Item = define('test-adopt-keyed')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<span></span>`)
        .setup(() => {})
    const box = adoptBox('<ul><!--[-->' +
        '<test-adopt-keyed key="a" label="a"><span></span>' +
        '</test-adopt-keyed>' +
        '<test-adopt-keyed key="b" label="b"><span></span>' +
        '</test-adopt-keyed><!--]--></ul>')
    const [a, b] = Array.from(box.querySelectorAll(Item.TAG))
    const items = signal(['a', 'b'])
    mount(box, bhtml`<ul>${() => items().map(k =>
        bhtml`<${Item} key=${k} label=${k} />`)}</ul>`)
    items(['b', 'a'])
    const now = Array.from(box.querySelectorAll(Item.TAG))
    t.equal(now.length, 2, 'no host created')
    t.equal(now[0], b, 'b moved to the front')
    t.equal(now[1], a, 'a is the same node')
    box.remove()
})

test('adopt: a host whose render link was stripped is adopted', t => {
    const Stripped = define('test-adopt-stripped')
        .withProps(p => ({ n: p.number() }))
        .setup(() => {})
    const box = adoptBox('<test-adopt-stripped n="1"><i></i>' +
        '</test-adopt-stripped>')
    const host = box.firstElementChild as any
    const n = signal(1)
    mount(box, bhtml`<${Stripped} n=${n} />`)
    n(2)
    t.equal(box.firstElementChild, host, 'host kept')
    t.equal(host.n, 2, 'prop bound')
    box.remove()
})

test('adopt: a host children range is bound; no range is skipped', t => {
    const Wrap = define('test-adopt-wrap')
        .render(({ children }) => bhtml`<b>own</b>${braw(children)}`)
        .setup(() => {})
    const Drop = define('test-adopt-drop')
        .render(() => bhtml`<b>own</b>`)
        .setup(() => {})
    const box = adoptBox(
        '<test-adopt-wrap><b>own</b><!--[c--><p class="in">in</p>' +
        '<!--]--></test-adopt-wrap>' +
        '<test-adopt-drop><b>own</b></test-adopt-drop>')
    const before = box.innerHTML
    const cls = signal('in')
    mount(box, bhtml`<${Wrap}><p class=${cls}>in</p></${Wrap}><${Drop}>
        <p class=${cls}>in</p></${Drop}>`)
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    cls('x')
    t.equal(box.querySelector(`${Wrap.TAG} p`)!.className, 'x',
        'content in the range is bound')
    t.equal(box.querySelectorAll('p').length, 1,
        'children of a host with no range are skipped')
    box.remove()
})

test('adopt: a region before the children leaves them bound', t => {
    const Card = define('test-adopt-region-kids')
        .render(({ children }) =>
            bhtml`<b>${() => 'own'}</b>${braw(children)}`)
        .setup(() => {})
    const box = adoptBox(
        '<test-adopt-region-kids><b><!--[-->own<!--]--></b>' +
        '<!--[c--><button>go</button><!--]-->' +
        '</test-adopt-region-kids>')
    const before = box.innerHTML
    let clicks = 0
    mount(box, bhtml`<${Card}><button
        onclick=${() => { clicks++ }}>go</button></${Card}>`)
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    box.querySelector('button')!.click()
    t.equal(clicks, 1, 'listener in the children is bound')
    box.remove()
})

test('adopt: nested hosts and regions do not end the children early', t => {
    const Inner = define('test-adopt-depth-in')
        .render(({ children }) => bhtml`<i>${braw(children)}</i>`)
        .setup(() => {})
    const Outer = define('test-adopt-depth-out')
        .render(({ children }) =>
            bhtml`<${Inner}><b>own</b></${Inner}>${braw(children)}`)
        .setup(() => {})
    const inner = (kids:string) =>
        `<test-adopt-depth-in><i><!--[c-->${kids}<!--]--></i>` +
        '</test-adopt-depth-in>'
    const box = adoptBox('<div><!--[--><test-adopt-depth-out>' +
        inner('<b>own</b>') + '<!--[c-->' + inner('<p>x</p>') +
        '<button>go</button><!--[-->t<!--]--><!--]-->' +
        '</test-adopt-depth-out><!--]--></div>')
    const host = box.querySelector(Outer.TAG)!
    const btn = box.querySelector('button')!
    const count = allNodes(host).length
    const n = signal(1)
    let clicks = 0
    mount(box, bhtml`<div>${() => {
        n()
        return bhtml`<${Outer}><${Inner}><p>x</p></${Inner}><button
            onclick=${() => { clicks++ }}>go</button>${() => 't'}</${Outer}>`
    }}</div>`)
    btn.click()
    t.equal(clicks, 1, 'outer children bound on adoption')
    n(2)
    t.equal(box.querySelector(Outer.TAG), host, 'host kept')
    t.equal(box.querySelector('button'), btn, 'button kept')
    t.equal(allNodes(host).length, count, 'children range morphed whole')
    btn.click()
    t.equal(clicks, 2, 'listener rebound once')
    box.remove()
})

test('adopt: a tag mismatch warns and leaves that subtree', t => {
    const box = adoptBox('<div><span title="a"></span></div>' +
        '<p title="a"></p>')
    const before = box.innerHTML
    const warns:unknown[] = []
    const warn = console.warn
    console.warn = (...a:unknown[]) => { warns.push(a) }
    const title = signal('a')
    try {
        mount(box, bhtml`<div><em title=${title}></em></div><p
            title=${title}></p>`)
    } finally {
        console.warn = warn
    }
    t.equal(warns.length, 1, 'warned once')
    t.equal(box.innerHTML, before, 'nothing changed on adoption')
    title('b')
    t.equal(box.querySelector('span')!.getAttribute('title'), 'a',
        'mismatched subtree untouched')
    t.equal(box.querySelector('p')!.getAttribute('title'), 'b',
        'sibling still bound')
    box.remove()
})

function quietly (fn:() => void):unknown[] {
    const warns:unknown[] = []
    const warn = console.warn
    console.warn = (...a:unknown[]) => { warns.push(a) }
    try {
        fn()
    } finally {
        console.warn = warn
    }
    return warns
}

test('adopt: mismatch lookahead stays inside a region range', t => {
    const box = adoptBox('<div><!--[--><i></i><!--[if IE]--><!--]-->' +
        '<b>out</b></div>')
    const before = box.innerHTML
    let inner = 0
    let outer = 0
    quietly(() => {
        mount(box, bhtml`<div>${() => bhtml`<b
            onclick=${() => { inner++ }}>in</b>`}<b
            onclick=${() => { outer++ }}>out</b></div>`)
    })
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    box.querySelector('b')!.click()
    t.equal(inner, 0, 'region markup did not bind outside its range')
    t.equal(outer, 1, 'sibling after the region is bound')
    box.remove()
})

test('adopt: an extra server node costs one warning', t => {
    const box = adoptBox('<h1>x</h1><p>y</p><button>go</button>')
    const h1 = box.firstChild
    const before = box.innerHTML
    let clicks = 0
    const warns = quietly(() => {
        mount(box, bhtml`<p>y</p><button
            onclick=${() => { clicks++ }}>go</button>`)
    })
    t.ok(warns.length <= 1, 'at most one warning')
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    t.equal(box.firstChild, h1, 'skipped server node is the same node')
    box.querySelector('button')!.click()
    t.equal(clicks, 1, 'later sibling is bound')
    box.remove()
})

test('adopt: a missing server node costs one warning', t => {
    const box = adoptBox('<p>y</p><button>go</button>')
    const p = box.firstChild
    const before = box.innerHTML
    let clicks = 0
    const warns = quietly(() => {
        mount(box, bhtml`<h1>x</h1><p>y</p><button
            onclick=${() => { clicks++ }}>go</button>`)
    })
    t.equal(warns.length, 1, 'one warning')
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    t.equal(box.firstChild, p, 'server node is the same node')
    box.querySelector('button')!.click()
    t.equal(clicks, 1, 'later sibling is bound')
    box.remove()
})

test('adopt: a button after a multi-node raw() is bound', t => {
    const box = adoptBox('<div><b>a</b>\n<i>b</i><button>go</button></div>')
    const before = box.innerHTML
    let clicks = 0
    const warns = quietly(() => {
        mount(box, bhtml`<div>${braw('<b>a</b>\n<i>b</i>')}<button
            onclick=${() => { clicks++ }}>go</button></div>`)
    })
    t.equal(warns.length, 0, 'no adoption warning')
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    box.querySelector('button')!.click()
    t.equal(clicks, 1, 'listener is attached')
    box.remove()
})

test('adopt: a text-leading raw() after text keeps the next button', t => {
    const box = adoptBox('<p>Price: &euro;5<button>go</button></p>')
    const before = box.innerHTML
    let clicks = 0
    const warns = quietly(() => {
        mount(box, bhtml`<p>Price: ${braw('&euro;5')}<button
            onclick=${() => { clicks++ }}>go</button></p>`)
    })
    t.equal(warns.length, 0, 'no adoption warning')
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    box.querySelector('button')!.click()
    t.equal(clicks, 1, 'listener is attached')
    box.remove()
})

test('adopt: a bound attribute after text-and-element raw() updates', t => {
    const box = adoptBox('<p>hi <b>a</b> <i>c</i>' +
        '<span title="a"></span></p>')
    const before = box.innerHTML
    const title = signal('a')
    const warns = quietly(() => {
        mount(box, bhtml`<p>${braw('hi <b>a</b> <i>c</i>')}<span
            title=${title}></span></p>`)
    })
    t.equal(warns.length, 0, 'no adoption warning')
    t.equal(box.innerHTML, before, 'adoption changed nothing')
    title('b')
    t.equal(box.querySelector('span')!.getAttribute('title'), 'b',
        'attribute is bound')
    box.remove()
})

// Attribute mutations under `root` caused by `fn`.
function attrWrites (root:Node, fn:() => void):MutationRecord[] {
    const obs = new MutationObserver(() => {})
    obs.observe(root, { attributes: true, subtree: true })
    try {
        fn()
        return obs.takeRecords()
    } finally {
        obs.disconnect()
    }
}

test('adopt: static attributes are not written', t => {
    const Host = define('test-adopt-static')
        .withProps(p => ({ label: p.string() }))
        .render(() => bhtml`<i></i>`)
        .setup(() => {})
    const box = adoptBox('<div class="a" data-x="1"><input disabled>' +
        '<a href="/q?a=1&amp;b=2" title="t">x</a></div>' +
        '<test-adopt-static key="k" label="l" class="h"><i></i>' +
        '</test-adopt-static>')
    const writes = attrWrites(box, () => {
        mount(box, bhtml`<div class="a" data-x="1"><input
            disabled=${true} /><a href="/q?a=1&b=2" title="t">x</a></div><${
            Host} key="k" label="l" class="h" />`)
    })
    t.equal(writes.length, 0, 'no attribute mutations')
    box.remove()
})

test('adopt: a bound attribute that matches is not written', t => {
    const box = adoptBox('<p title="a" class="c"></p><b></b>')
    const title = signal('a')
    const hidden = signal(false)
    const writes = attrWrites(box, () => {
        mount(box, bhtml`<p title=${title} class=${() => 'c'}></p><b
            hidden=${hidden}></b>`)
    })
    t.equal(writes.length, 0, 'no attribute mutations')
    const later = attrWrites(box, () => { title('b') })
    t.equal(later.length, 1, 'a later change is written')
    t.equal(box.querySelector('p')!.getAttribute('title'), 'b',
        'attribute follows the signal')
    box.remove()
})

test('adopt: a bound attribute that differs is written once', t => {
    const box = adoptBox('<p title="old" hidden></p>')
    const title = signal('new')
    const hidden = signal(false)
    const p = box.querySelector('p')!
    const writes = attrWrites(box, () => {
        mount(box, bhtml`<p title=${title} hidden=${hidden}></p>`)
    })
    t.equal(writes.length, 2, 'one write per differing attribute')
    t.equal(p.getAttribute('title'), 'new', 'value written')
    t.ok(!p.hasAttribute('hidden'), 'false removes the attribute')
    title('newer')
    hidden(true)
    t.equal(p.getAttribute('title'), 'newer', 'later changes still apply')
    t.ok(p.hasAttribute('hidden'), 'later true adds the attribute')
    box.remove()
})

test('adopt: a control whose attribute matches is not written', t => {
    const box = adoptBox('<input value="a">')
    const input = box.querySelector('input')!
    // the visitor typed before hydration
    input.value = 'typed'
    const v = signal('a')
    const writes = attrWrites(box, () => {
        mount(box, bhtml`<input value=${v} />`)
    })
    t.equal(writes.length, 0, 'no attribute mutations')
    t.equal(input.value, 'typed', 'the typed value is untouched')
    box.remove()
})

test('adopt: a control whose attribute differs gets the bound value', t => {
    const box = adoptBox('<input value="old">')
    const input = box.querySelector('input')!
    mount(box, bhtml`<input value=${signal('new')} />`)
    t.equal(input.value, 'new', 'the property holds the bound value')
    box.remove()
})

test('adopt: an edit survives a re-render; a new bound value wins', t => {
    const box = adoptBox('<form data-n="1"><input value="a"></form>')
    const input = box.querySelector('input')!
    const v = signal('a')
    const n = signal(1)
    mount(box, bhtml`<form data-n=${n}><input value=${v} /></form>`)
    input.value = 'typed'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    n(2)
    t.equal(input.value, 'typed', 'unrelated re-render keeps the edit')
    v('b')
    t.equal(input.value, 'b', 'a changed bound value replaces the edit')
    box.remove()
})

test('adopt: an edit in an adopted region survives a re-render', t => {
    const box = adoptBox('<div><!--[--><form data-n="1"><input value="a">' +
        '</form><!--]--></div>')
    const input = box.querySelector('input')!
    const v = signal('a')
    const n = signal(1)
    mount(box, bhtml`<div>${() => bhtml`<form data-n=${n()}>
        <input value=${v()} /></form>`}</div>`)
    input.value = 'typed'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    n(2)
    t.equal(box.querySelector('input'), input, 'input is kept')
    t.equal(input.value, 'typed', 'unrelated re-render keeps the edit')
    v('b')
    t.equal(input.value, 'b', 'a changed bound value replaces the edit')
    box.remove()
})

test('adopt: a checked checkbox bound true is not written', t => {
    const box = adoptBox('<input type="checkbox" checked>' +
        '<input type="checkbox" checked>')
    const [a, b] = box.querySelectorAll('input')
    // the visitor unchecked the first before hydration
    a.checked = false
    const writes = attrWrites(box, () => {
        mount(box, bhtml`<input type="checkbox" checked=${signal(true)} />
            <input type="checkbox" checked=${signal(false)} />`)
    })
    t.equal(writes.length, 0, 'no attribute mutations')
    t.equal(a.checked, false, 'bound true matches the server: no write')
    t.equal(b.checked, false, 'bound false unchecks it')
    box.remove()
})

test('adopt: an iframe does not reload', async t => {
    const box = adoptBox('<iframe srcdoc="<p>x</p>" title="f"></iframe>')
    const frame = box.querySelector('iframe')!
    await new Promise(resolve => frame.addEventListener('load', resolve,
        { once: true }))
    let loads = 0
    frame.addEventListener('load', () => { loads++ })
    const title = signal('f')
    mount(box, bhtml`<iframe srcdoc="<p>x</p>" title=${title}></iframe>`)
    await new Promise(resolve => setTimeout(resolve, 200))
    t.equal(loads, 0, 'no second load event')
    box.remove()
})

test('adopt: dispose stops updates and leaves the DOM', t => {
    const box = adoptBox('<div><!--[--><!--]--></div>')
    const open = signal(false)
    const dispose = mount(box, bhtml`<div>${() =>
        open() && bhtml`<p></p>`}</div>`)
    const div = box.firstElementChild
    dispose()
    open(true)
    t.equal(box.querySelectorAll('p').length, 0, 'region did not update')
    t.equal(box.firstElementChild, div, 'DOM left in place')
})

test('all done', () => {
    // @ts-expect-error tests
    window.testsFinished = true
})

function parse (markup:string):Document {
    return new DOMParser().parseFromString(markup, 'text/html')
}

test('example Counter: count prop drives the badge; buttons emit', t => {
    const count = signal(12)
    const box = document.createElement('div')
    document.body.appendChild(box)
    // server-shaped markup: the counter render link is stripped in the
    // browser build, so the fixture is static HTML
    box.innerHTML = `<hydra-counter count="12">
        <div class="current"><span>
            <hydra-badge data-ref="current" class="number" label="12">
                <span class="badge-text" data-ref="text">12</span>
            </hydra-badge>
        </span></div>
        <button data-ref="dec">-</button>
        <button data-ref="inc">+</button>
    </hydra-counter>`
    t.ok(customElements.get(Counter.TAG), 'counter is defined')
    t.ok(customElements.get(Badge.TAG), 'badge is defined')
    const host = box.querySelector('hydra-counter') as
        InstanceType<typeof Counter>
    const text = box.querySelector('hydra-badge [data-ref="text"]')!
    bindProp(host, 'count', count)

    const events:string[] = []
    host.addEventListener('increment', () => events.push('increment'))
    host.addEventListener('decrement', () => events.push('decrement'))
    ;(box.querySelector('[data-ref="inc"]') as HTMLElement).click()
    ;(box.querySelector('[data-ref="dec"]') as HTMLElement).click()
    t.deepEqual(events, ['increment', 'decrement'], 'buttons emit events')
    t.equal(count(), 12, 'counter does not change the count itself')

    count(40)
    t.equal(Number(text.textContent), 40, 'outside count is shown')
    box.remove()
})

test('example Badge: assigning label updates its text element', t => {
    const box = document.createElement('div')
    document.body.appendChild(box)
    const dispose = mount(box, bhtml`<${Badge} label="one" />`)
    const host = box.querySelector('hydra-badge') as
        InstanceType<typeof Badge>
    const text = host.querySelector('[data-ref="text"]')!
    host.label = 'two'
    t.equal(text.textContent, 'two', 'plain value updates the text')
    const s = signal('three')
    host.label = s as unknown as string
    t.equal(text.textContent, 'three', 'signal value updates the text')
    s('four')
    t.equal(text.textContent, 'four', 'signal change updates the text')
    dispose()
    box.remove()
})

test('example Notice: dismiss emits and does not remove the host', t => {
    const box = document.createElement('div')
    document.body.appendChild(box)
    const dispose = mount(box, bhtml`<${Notice} message="hi" />`)
    const host = box.querySelector(Notice.TAG)!
    let dismissed = 0
    host.addEventListener('dismiss', () => { dismissed++ })
    ;(host.querySelector('button') as HTMLElement).click()
    t.equal(dismissed, 1, 'dispatches one dismiss event')
    t.ok(host.isConnected, 'host is still connected')
    dispose()
    box.remove()
})

test('example notice page: state opens and dismisses the notice', t => {
    const box = document.createElement('div')
    document.body.appendChild(box)
    const state = State({ route: '/notice' })
    const dispose = pageMount(box, NoticePage(state))
    const notices = () => box.querySelectorAll(Notice.TAG)
    const show = box.querySelector('#show-notice') as HTMLElement
    t.equal(notices().length, 0, 'closed by default')

    show.click()
    t.equal(state.noticeOpen(), true, 'show opens the notice in state')
    t.equal(notices().length, 1, 'one notice host is added')

    ;(notices()[0].querySelector('button') as HTMLElement).click()
    t.equal(state.noticeOpen(), false, 'dismiss closes it in state')
    t.equal(notices().length, 0, 'the notice host is removed')

    show.click()
    t.equal(notices().length, 1, 'it can be opened again')
    dispose()
    box.remove()
})

// Browser templater: a spread of untrusted keys

const BAD_KEY = 'x" onload="alert(1)'

function hasOnly (el:Element):boolean {
    return el.getAttribute('data-ok') === 'yes' &&
        el.getAttributeNames().every(n => n === 'data-ok')
}

test('mount: a spread skips an invalid attribute name', t => {
    const attrs = { [BAD_KEY]: 'v', 'data-ok': 'yes' }
    const box = document.createElement('div')
    try {
        mount(box, bhtml`<div ...${attrs}></div>`)
    } catch (err) {
        t.fail(`create threw: ${err}`)
    }
    t.ok(box.firstElementChild && hasOnly(box.firstElementChild),
        'create: only the valid attribute')

    const s = document.createElement('div')
    s.innerHTML = String(bhtml`<div ...${attrs}></div>`)
    t.ok(hasOnly(s.firstElementChild!), 'String(): only the valid attribute')

    const n = signal(1)
    const patched = document.createElement('div')
    try {
        mount(patched, bhtml`<section>${
            () => bhtml`<div ...${attrs} data-n=${n()}></div>`
        }</section>`)
        n(2)
    } catch (err) {
        t.fail(`patch threw: ${err}`)
    }
    const div = patched.querySelector('div')!
    t.equal(div.getAttribute('data-n'), '2', 'patched')
    t.ok(!div.getAttributeNames().some(x => x !== 'data-ok' &&
        x !== 'data-n'), 'patch: no invalid attribute')

    const adopted = adoptBox('<div data-ok="yes"></div>')
    try {
        mount(adopted, bhtml`<div ...${attrs}></div>`)
    } catch (err) {
        t.fail(`adopt threw: ${err}`)
    }
    t.ok(hasOnly(adopted.firstElementChild!), 'adopt: only the valid one')
    adopted.remove()
})

test('mount: a host skips an invalid extra attribute name', t => {
    const Kept = define('test-mount-badattr')
        .render(() => bhtml`<i></i>`)
        .setup(() => {})
    const attrs = { [BAD_KEY]: 'v', 'data-ok': 'yes' }
    const box = document.createElement('div')
    document.body.appendChild(box)
    mount(box, bhtml`<${Kept} ...${attrs} />`)
    t.ok(hasOnly(box.firstElementChild!), 'host has only the valid one')
    box.remove()
})

test('mount: a signal attribute with an invalid name is never written',
    t => {
        const v = signal('a')
        const ok = signal('a')
        const box = document.createElement('div')
        try {
            mount(box, bhtml`<p ...${{ '0bad': v, [BAD_KEY]: v }}
                data-ok=${ok}></p>`)
            v('b')
            ok('yes')
        } catch (err) {
            t.fail(`threw: ${err}`)
        }
        const p = box.firstElementChild!
        t.equal(p.getAttribute('data-ok'), 'yes', 'valid signal updates')
        t.ok(hasOnly(p), 'invalid names never written')
    })

test('parity table: browser String() matches the expected HTML', t => {
    for (const c of parityCases) {
        t.equal(String(c.input(bhtml)), c.expected, c.name)
    }
})

test('parity table: server and browser emit the same HTML', t => {
    for (const c of parityCases) {
        t.equal(
            stripMarkers(String(c.input(html))),
            String(c.input(bhtml)),
            c.name
        )
    }
})

// Core renders an empty host with a kept render link (ADR-011)

test('empty host: rendered before refs resolve and setup runs', t => {
    let seen:Element|undefined
    const El = define('test-empty-host-render')
        .withRefs(r => ({ btn: r.one() }))
        .render(() => bhtml`<button data-ref="btn">go</button>`)
        .setup(ctx => { seen = ctx.refs.btn })
    const host = document.createElement(El.TAG)
    document.body.appendChild(host)
    const btn = host.querySelector('button')
    t.ok(btn, 'host has its rendered children')
    t.ok(seen && seen === btn, 'setup ref is the rendered element')
    host.remove()
})

test('empty host: in the document before define is rendered', t => {
    const tag = 'test-empty-host-predef'
    const box = document.createElement('div')
    box.innerHTML = `<${tag}></${tag}>`
    document.body.appendChild(box)
    let seen:Element|undefined
    define(tag)
        .withRefs(r => ({ btn: r.one() }))
        .render(() => bhtml`<button data-ref="btn">go</button>`)
        .setup(ctx => { seen = ctx.refs.btn })
    const btn = box.querySelector(tag + ' button')
    t.ok(btn, 'upgraded host has its rendered children')
    t.ok(seen && seen === btn, 'setup ref is the rendered element')
    box.remove()
})

test('empty host: render uses attribute and pre-upgrade props', t => {
    const tag = 'test-empty-host-props'
    const pre = document.createElement(tag) as any
    pre.lo = 3
    pre.setAttribute('val', 'abc')
    define(tag)
        .withProps(p => ({ val: p.string(), lo: p.number() }))
        .withRefs(r => ({ input: r.one() }))
        .render(({ props }) => bhtml`<input data-ref="input"
            value=${props.val} min=${props.lo} />`)
        .setup(() => {})
    document.body.appendChild(pre)
    const input = pre.querySelector('input') as HTMLInputElement|null
    t.equal(input?.value, 'abc', 'attribute reached the render')
    t.equal(input?.min, '3', 'property set before upgrade reached it')
    pre.remove()
})

test('empty host: whitespace-only host is rendered', t => {
    const tag = 'test-empty-host-ws'
    let seen:Element|undefined
    define(tag)
        .withRefs(r => ({ btn: r.one() }))
        .render(() => bhtml`<button data-ref="btn">go</button>`)
        .setup(ctx => { seen = ctx.refs.btn })
    const box = document.createElement('div')
    box.innerHTML = `<${tag}>\n   </${tag}>`
    document.body.appendChild(box)
    const btn = box.querySelector(tag + ' button')
    t.ok(btn, 'whitespace host has its rendered children')
    t.ok(seen && seen === btn, 'setup ref is the rendered element')
    box.remove()
})

test('empty host: a host with server markup is not rendered over', t => {
    const tag = 'test-empty-host-server'
    let seen:Element|undefined
    define(tag)
        .withRefs(r => ({ btn: r.one() }))
        .render(() => bhtml`<button data-ref="btn">client</button>`)
        .setup(ctx => { seen = ctx.refs.btn })
    const host = document.createElement(tag)
    const btn = document.createElement('button')
    btn.setAttribute('data-ref', 'btn')
    host.appendChild(btn)
    const box = document.createElement('div')
    document.body.appendChild(box)
    const mo = new MutationObserver(() => {})
    mo.observe(box, { childList: true, subtree: true })
    box.appendChild(host)
    const records = mo.takeRecords()
    mo.disconnect()
    t.ok(
        records.every(r => r.target === box),
        'no child mutations inside the host'
    )
    t.ok(seen === btn, 'setup ref is the original server element')
    t.ok(host.firstElementChild === btn, 'server element still in place')
    box.remove()
})

test('empty host: no render link still throws missing refs', t => {
    let ran = false
    const El = define('test-empty-host-light')
        .withRefs(r => ({ btn: r.one() }))
        .setup(() => { ran = true })
    const host = document.createElement(El.TAG)
    let caught:Error|null = null
    try {
        (host as any).connectedCallback()
    } catch (err) {
        caught = err as Error
    }
    t.ok(caught !== null, 'connect throws for an empty host')
    t.ok(!ran, 'setup did not run')
    t.equal(host.childElementCount, 0, 'host stays empty')
})

test('empty host: reconnect after teardown does not render again', async t => {
    let runs = 0
    const El = define('test-empty-host-reconnect')
        .withRefs(r => ({ btn: r.one() }))
        .render(() => bhtml`<button data-ref="btn">go</button>`)
        .setup(() => { runs++ })
    const host = document.createElement(El.TAG)
    document.body.appendChild(host)
    const btn = host.querySelector('button')
    host.remove()
    await Promise.resolve()
    document.body.appendChild(host)
    t.equal(runs, 2, 'setup ran again on reconnect')
    t.equal(host.children.length, 1, 'still one child element')
    t.ok(btn && host.firstElementChild === btn, 'same rendered node kept')
    host.remove()
})

test('empty host: waits for a provided context before rendering', t => {
    const Ctx = createContext<string>()
    let seen:Element|undefined
    const El = define('test-empty-host-ctx')
        .withRefs(r => ({ btn: r.one() }))
        .withContexts(() => ({ c: Ctx }))
        .render(() => bhtml`<button data-ref="btn">go</button>`)
        .setup(ctx => { seen = ctx.refs.btn })
    const wrapper = document.createElement('div')
    const host = document.createElement(El.TAG)
    wrapper.appendChild(host)
    document.body.appendChild(wrapper)
    t.equal(host.childNodes.length, 0, 'host stays empty while waiting')
    t.ok(!seen, 'setup has not run')
    provide(wrapper, Ctx, 'x')
    const btn = host.querySelector('button')
    t.ok(btn, 'host rendered once the context is provided')
    t.ok(seen && seen === btn, 'setup ref is the rendered element')
    wrapper.remove()
})

test('empty host: a templater host with an empty children region keeps it',
    t => {
        const items = signal<string[]>([])
        define('test-empty-host-region')
            .render(({ children }) => bhtml`${braw(children)}`)
            .setup(() => {})
        const root = document.createElement('div')
        document.body.appendChild(root)
        try {
            mount(root, bhtml`<test-empty-host-region>${() =>
                items().map(i => bhtml`<li key=${i}>${i}</li>`)
            }</test-empty-host-region>`)
            items(['a', 'b'])
        } catch (err) {
            t.fail(`threw: ${err}`)
        }
        const host = root.querySelector('test-empty-host-region')!
        t.equal(host.querySelectorAll('li').length, 2,
            'list renders after the region is filled')
        root.remove()
    })

test('empty host: a server host holding only region markers is adopted',
    t => {
        const tag = 'test-empty-host-markers'
        const box = document.createElement('div')
        box.innerHTML = `<${tag}><!--[c--><!--[--><!--]--><!--]--></${tag}>`
        document.body.appendChild(box)
        define(tag)
            .render(() => bhtml`<button>client</button>`)
            .setup(() => {})
        const host = box.querySelector(tag)!
        t.equal(host.childElementCount, 0, 'no client markup written')
        t.equal(host.childNodes.length, 4, 'region markers are kept')
        box.remove()
    })

import './preact-browser.js'
