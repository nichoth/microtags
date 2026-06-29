import { test } from '@substrate-system/tapzero'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { signal, effect } from 'alien-signals'
import { peek, untracked, define } from '../src/index.js'
import { factory } from '../src/factory.js'
import { coerceNumber } from '../src/util.js'
import { ComponentBuilder } from '../src/builders.js'
import { createContext, provide } from '../src/context.js'
import type { ContextToken } from '../src/types.js'
import { render, renderList } from '../src/render.js'

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

test('factory: disconnectedCallback runs all registered cleanups', t => {
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
    t.equal(cleanupCount, 2, 'both cleanups ran on disconnect')
})

test('factory: effects are disposed on disconnect', t => {
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
    count(2)
    t.equal(effectRunCount, 2, 'effect did NOT run after disconnect')
})

test('factory: reconnecting re-runs setup with fresh scope', t => {
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
    t.equal(cleanupCount, 1, 'cleanup ran on disconnect')
    document.body.appendChild(el)
    t.equal(setupCount, 2, 'setup re-ran on reconnect')
    document.body.removeChild(el)
    t.equal(cleanupCount, 2, 'cleanup ran again on second disconnect')
})

test('factory: reconnect preserves programmatically-set prop values', t => {
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
    document.body.appendChild(el) // reconnect: no attr → signal keeps 42
    t.equal(captured[1], 42, 'reconnect: programmatically-set value preserved')
    document.body.removeChild(el)
})

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

    // Browsers swallow exceptions thrown from lifecycle callbacks when called
    // via DOM methods (e.g. removeChild). Call disconnectedCallback directly
    // to verify the throw propagation contract.
    let caughtErr:Error | null = null
    try {
        (el as any).disconnectedCallback()
    } catch (err) {
        caughtErr = err as Error
    }
    t.ok(secondCleanupRan, 'second cleanup ran despite first throwing')
    t.ok(caughtErr !== null, 'first error was re-thrown')
    t.equal(caughtErr?.message, 'first', 'correct error re-thrown')

    // Remove from DOM (cleanups already cleared by the direct call above)
    document.body.removeChild(el)
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

test('ctx.on: listener is called and auto-removed on disconnect', t => {
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
    el.click()
    t.equal(clickCount, 1, 'listener not called after disconnect')
})

test('ctx.bind: updates DOM property reactively, stops after disconnect', t => {
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

test('cleanup: ctx.on listener removed on disconnect', t => {
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
    el.click()
    t.equal(clickCount, 1, 'listener not called after disconnect')
})

test('cleanup: ctx.effect disposed on disconnect', t => {
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
    external(2)
    t.equal(effectRuns, 2, 'effect did not run after disconnect')
})

test('cleanup: ctx.bind stops updating DOM property on disconnect', t => {
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
    label('after-disconnect')
    t.equal(span.title, 'updated', 'binding stopped after disconnect')
})

test('cleanup: ctx.onCleanup callback runs on disconnect', t => {
    let cleanupRan = false

    define('test-us014-oncleanup')
        .setup((ctx) => {
            ctx.onCleanup(() => { cleanupRan = true })
        })

    const el = document.createElement('test-us014-oncleanup')
    document.body.appendChild(el)
    t.ok(!cleanupRan, 'cleanup not called before disconnect')
    document.body.removeChild(el)
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

    let caught:Error | null = null
    try {
        (el as any).disconnectedCallback()
    } catch (err) {
        caught = err as Error
    }

    t.ok(secondRan, 'second cleanup ran despite first throwing')
    t.ok(thirdRan, 'third cleanup ran despite first throwing')
    t.ok(caught !== null, 'error was re-thrown')
    t.equal(caught?.message, 'first-throws', 'correct error re-thrown')

    document.body.removeChild(el)
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

test('all done', () => {
    // @ts-expect-error tests
    window.testsFinished = true
})
