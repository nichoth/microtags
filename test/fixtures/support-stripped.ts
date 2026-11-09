// Every render link here is stripped, so the bundle should not
// contain the server render support module.
import { define } from 'microtags'

export const Counter = define('support-stripped')
    .withProps(p => ({ count: p.number(), open: p.boolean() }))
    .withRefs(r => ({ btn: r.one<HTMLButtonElement>() }))
    .render(({ props }) => `<button data-ref="btn">${props.count}</button>`)
    .setup(ctx => {
        ctx.refs.btn.addEventListener('click', () => {
            ctx.props.count(ctx.props.count() + 1)
        })
    })
