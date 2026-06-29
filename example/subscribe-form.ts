import { signal, startBatch, endBatch } from 'alien-signals'
import { z } from 'zod'
import { define } from '../src/index.js'

/**
 * A form that validates its email field with Zod on the client.
 * Validation runs live via `safeParse`; the Subscribe button is disabled
 * until the value is valid. The error message follows the "touched" best
 * practice: it stays hidden until the field has been focused and blurred
 * once, then updates live on every keystroke until the value is valid.
 *
 * Depends on pre-rendered HTML: a <form> with an <input>, a submit
 * <button>, a `.error` region (aria-live) and a `.status` region.
 */
const Email = z.email('Please enter a valid email address.')

export const SubscribeForm = define('subscribe-form')
    .withRefs(r => ({
        form: r.one('form'),
        input: r.one('input'),
        submit: r.one('button'),
        error: r.one('.error'),
        status: r.one('.status'),
    }))
    .setup(ctx => {
        // the live input value, and whether the field has been blurred once
        const value = signal('')
        const touched = signal(false)

        // two-way bind input.value <-> value (write-back on the `input`
        // event); the forward path also clears the field on reset
        ctx.bind(value, ctx.refs.input)

        // best practice: only reveal errors after the first blur
        ctx.on(ctx.refs.input, 'blur', () => touched(true))

        // single effect derives all DOM from the two signals. `message`
        // is computed in the !success branch so TypeScript narrows
        // `result` to the failure variant (result.error).
        ctx.effect(() => {
            const result = Email.safeParse(value())
            const message = result.success ?
                '' :
                result.error.issues[0].message
            const showError = touched() && !result.success

            ctx.refs.submit.disabled = !result.success
            ctx.refs.input.setAttribute('aria-invalid', String(showError))
            ctx.refs.error.textContent = showError ? message : ''
        })

        // submit button
        ctx.on(ctx.refs.form, 'submit', ev => {
            ev.preventDefault()
            // defensive: the button is already disabled when invalid
            if (!Email.safeParse(value()).success) return
            ctx.refs.status.textContent = 'Thanks for subscribing!'
            startBatch()
            value('')
            touched(false)
            endBatch()
        })
    })
