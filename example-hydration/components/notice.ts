import { define } from 'microtags'
import { html } from 'microtags/htm'

/**
 * A message with a dismiss button. The button emits `dismiss`; whoever
 * shows the notice decides what that does.
 */
export const Notice = define('hydra-notice')
    .withProps(p => ({
        message: p.string(),
    }))
    .withRefs(r => ({
        dismiss: r.one('button'),
    }))
    .render(({ props, refs }) => {
        return html`
            <p class="notice-text">${props.message}</p>
            <button data-ref="${refs.dismiss}">Dismiss</button>`
    }, { client: true })
    .setup(ctx => {
        ctx.on(ctx.refs.dismiss, 'click', () => {
            ctx.emit('dismiss')
        })
    })
