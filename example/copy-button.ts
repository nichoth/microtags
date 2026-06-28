import { define } from '../src/index.js'

/**
 * A button that copies a value to the clipboard. The value to copy is
 * supplied through the attribute-backed `value` prop, so a parent can
 * drive it reactively (see <my-counter> below). On click it writes the
 * value, then shows transient success feedback. The feedback text and
 * how long it stays visible are configurable via the `success` (default
 * "Copied!") and `timeout` (default 1000ms) attributes.
 */
export const CopyBtn = define('copy-btn')
    .withProps(p => ({
        value: p.number(),
        success: p.string(),
        timeout: p.number(),
    }))
    .setup(ctx => {
        const button = ctx.host.querySelector('button')!
        button.textContent = 'Copy'

        // append to the host element
        ctx.host.appendChild(button)

        let timer:ReturnType<typeof setTimeout>|undefined

        ctx.on(button, 'click', async () => {
            try {
                await navigator.clipboard.writeText(String(ctx.props.value()))
            } catch {
                return  // clipboard unavailable; skip the feedback
            }

            // When the attributes are absent the coercers yield '' and
            // NaN, so fall back to the original "Copied!" / 1000ms.
            const success = ctx.props.success() || 'Copied!'
            const ms = ctx.props.timeout()
            const delay = Number.isNaN(ms) ? 1000 : ms

            button.textContent = success
            ctx.host.classList.add('copied')
            clearTimeout(timer)
            timer = setTimeout(() => {
                button.textContent = 'Copy'
                ctx.host.classList.remove('copied')
            }, delay)
        })

        ctx.onCleanup(() => {
            clearTimeout(timer)
            button.remove()
        })
    })

