// The same component with its render link kept. `microtags/register`
// stands in for the import the transform would inject.
import 'microtags/register'
import { define } from 'microtags'

export const Counter = define('x-counter')
    .withProps(p => ({ count: p.number(), open: p.boolean() }))
    .withRefs(r => ({ btn: r.one<HTMLButtonElement>() }))
    .render(({ props, refs }) => {
        return `<button data-ref="${refs.btn}">${props.count}</button>`
    })
    .setup(ctx => {
        ctx.refs.btn.addEventListener('click', () => {
            ctx.props.count(ctx.props.count() + 1)
        })
    })
