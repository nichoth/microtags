import { computed } from 'alien-signals'
import { define, bindProp } from 'microtags'
import { html, raw } from 'microtags/htm'
import { Badge } from './badge.js'
import './counter.css'

/**
 * A view of a count it does not own. The buttons emit `increment` and
 * `decrement`; whoever passes `count` decides what they do.
 */
export const Counter = define('hydra-counter')
    .withProps(p => ({
        count: p.number(),
    }))
    .withRefs(r => ({
        current: r.one<InstanceType<typeof Badge>>(),
        inc: r.one<HTMLButtonElement>(),
        dec: r.one<HTMLButtonElement>(),
    }))
    .render(({ props, refs, children }) => {
        return html`
            <div class="current">
                <span>Current:</span>
                <span>
                    <${Badge}
                        data-ref="${refs.current}"
                        class="number"
                        label=${String(props.count)}
                    />
                </span>
            </div>
            <div class="controls">
                <button class="dec"
                    data-ref="${refs.dec}"
                    aria-label="Decrement"
                >-</button>
                <button class="inc"
                    data-ref="${refs.inc}"
                    aria-label="Increment"
                >+</button>
            </div>
            ${raw(children)}`
    })
    .setup(ctx => {
        const label = computed(() => String(ctx.props.count()))
        // the badge's label reads through to the computed
        bindProp(ctx.refs.current, 'label', label)

        ctx.on(ctx.refs.inc, 'click', () => { ctx.emit('increment') })
        ctx.on(ctx.refs.dec, 'click', () => { ctx.emit('decrement') })
    })
