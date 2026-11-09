// A client module after the transform stripped every render link.
import { define } from 'microtags'

export const Counter = define('x-counter')
    .withProps(p => ({ count: p.number(), open: p.boolean() }))
    .withRefs(r => ({ btn: r.one<HTMLButtonElement>() }))
    .setup(ctx => {
        ctx.refs.btn.addEventListener('click', () => {
            ctx.props.count(ctx.props.count() + 1)
        })
    })
