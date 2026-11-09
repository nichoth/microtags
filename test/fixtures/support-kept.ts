// The render link is kept, so the bundle needs the server render
// support module.
import { define } from 'microtags'

export const Counter = define('support-kept')
    .withProps(p => ({ count: p.number(), open: p.boolean() }))
    .withRefs(r => ({ btn: r.one<HTMLButtonElement>() }))
    .render(
        ({ props }) => `<button data-ref="btn">${props.count}</button>`,
        { client: true }
    )
    .setup(ctx => {
        ctx.refs.btn.addEventListener('click', () => {
            ctx.props.count(ctx.props.count() + 1)
        })
    })
