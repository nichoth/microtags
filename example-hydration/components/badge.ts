import { define } from 'microtags'
import { html } from 'microtags/htm'
import './badge.css'

export const Badge = define('hydra-badge')
    .withProps(p => ({
        label: p.string(),
    }))
    .withRefs(r => ({
        text: r.one<HTMLSpanElement>(),
    }))
    .render(({ props, refs }) => {
        return html`<span class="badge-text" data-ref="${refs.text}">${
            props.label
        }</span>`
    }, { client: true })
    .setup(ctx => {
        ctx.effect(() => {
            // the server already rendered the label; write only on a change
            const label = ctx.props.label()
            const text = ctx.refs.text
            if (text.textContent !== label) text.textContent = label
        })
    })
