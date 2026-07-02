import { signal } from 'alien-signals'
import { define } from '../src/index.js'
import './count-button.js'
import './copy-button.js'
import './subscribe-form.js'
import './render-demo.js'
import './theme-toggle.js'

// these web coponents depend on having HTML already rendered.

/**
 *  - attribute-backed prop (`start`)
 *  - data-ref elements (the <count-button> and <copy-btn> children)
 *  - ctx.effect, ctx.on
 */
export const MyCounter = define('my-counter')
    .withProps(p => ({
        start: p.number(),  // the starting count (an attribute)
    }))
    .withRefs(r => ({  // keys in this object are the `data-ref` names in HTML
        display: r.one<HTMLDivElement>(),  // typed as HTMLDivElement,
        inc: r.one(),  // depends on a child in HTML with `data-ref="inc"`
        dec: r.one(),  // depends on a child in HTML with `data-ref="dec"`
        copy: r.one(),  // the <copy-btn> element, via `data-ref="copy"`
    }))
    .setup(ctx => {
        const count = signal(ctx.props.start())
        // `ctx.refs` are expected to be HTML elements with a matching `data-ref`
        const display = ctx.refs.display

        // whenever `count` changes
        ctx.effect(() => {
            display.textContent = `Count: ${count()}`
            display.style.color = count() < 0 ? 'red' : 'inherit'
        })

        // Reflect the live count onto the copy button's `value` attribute.
        // Because `value` is attribute-backed, this flows into <copy-btn>'s
        // own signal, so it always copies the current count.
        ctx.effect(() => {
            const copy = ctx.refs.copy
            copy.setAttribute('value', String(count()))
        })

        /**
         * Listen for clicks.
         */
        ctx.on(ctx.refs.inc, 'click', () => {
            count(count() + 1)
        })

        ctx.on(ctx.refs.dec, 'click', () => {
            count(count() - 1)
        })
    })
