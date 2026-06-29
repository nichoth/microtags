import { define } from '../src/index.js'

/**
 * Depends on pre-rendered HTML with a <button>.
 * There is no Shadow DOM, so clicks bubble up to the parent <my-counter>,
 * which wires them via refs.
 */
export const CountBtn = define('count-button')
    .setup(ctx => {
        const button = ctx.host.querySelector('button')!

        // Forward an aria-label from the host onto the real <button> so
        // screen readers announce a descriptive name ("Increment") instead
        // of the terse visible text ("+").
        const ariaLabel = ctx.host.getAttribute('aria-label')
        if (ariaLabel) {
            button.setAttribute('aria-label', ariaLabel)
            ctx.host.removeAttribute('aria-label')
        }

        ctx.onCleanup(() => button.remove())
    })

