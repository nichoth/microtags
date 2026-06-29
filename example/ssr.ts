import { myCounter } from './index.js'
import { CopyBtn } from './copy-button.js'
import { CountBtn } from './count-button.js'
import { SubscribeForm } from './subscribe-form.js'
import { RenderDemo } from './render-demo.js'
import { NBSP } from './constants.js'

// Server-render the full example page using each component's exposed
// `.TAG` and `.refs`, so the markup never hardcodes a tag name or a
// `data-ref` value. `npm start` redirects this output into
// example/index.html, so the page the browser hydrates is produced by
// the SSR path first.

const START = 5

function renderCounter ():string {
    return `
        <${myCounter.TAG} start="${START}">
            <div data-ref="${myCounter.refs.display}"
                role="status"
                class="count"
            >${START}</div>

            <div class="controls">
                <${CountBtn.TAG}
                    class="dec"
                    data-ref="${myCounter.refs.dec}"
                    aria-label="Decrement"
                >
                    <button>-</button>
                </${CountBtn.TAG}>

                <${CopyBtn.TAG}
                    class="copy"
                    data-ref="${myCounter.refs.copy}"
                >
                    <button>Copy</button>
                </${CopyBtn.TAG}>

                <${CountBtn.TAG}
                    class="inc"
                    data-ref="${myCounter.refs.inc}"
                    aria-label="Increment"
                >
                    <button>+</button>
                </${CountBtn.TAG}>
            </div>
        </${myCounter.TAG}>`
}

function renderSubscribeForm ():string {
    return `
        <section class="subscribe">
            <h2>Client-side validation</h2>
            <${SubscribeForm.TAG}>
                <form novalidate>
                    <label for="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        autocomplete="email"
                        aria-describedby="email-error"
                    >
                    <button type="submit" disabled>Subscribe</button>
                    <p id="email-error" class="error" aria-live="polite"></p>
                    <p class="status" role="status" aria-live="polite"></p>
                </form>
            </${SubscribeForm.TAG}>
        </section>`
}

function renderRenderDemo ():string {
    return `
        <section class="render-demo">
            <h2>Keyed rendering preserves state</h2>
            <${RenderDemo.TAG}>
                <p>Type into a row, then watch the tick or press Shuffle.
                    Your text rides along because rows are reused by key,
                    never rebuilt; while the list merely re-renders, the
                    row you are editing even keeps its focus and caret.</p>

                <ul data-ref="${RenderDemo.refs.list}"></ul>

                <button data-ref="${RenderDemo.refs.shuffle}">
                    Shuffle order
                </button>

                <template data-ref="${RenderDemo.refs.rowTpl}">
                    <li>
                        <span class="label"></span>
                        <input class="note" aria-label="editable note"
                            placeholder="type here">
                    </li>
                </template>

                <p class="summary" data-ref="${RenderDemo.refs.summary}"></p>

                <template data-ref="${RenderDemo.refs.summaryTpl}">
                    <span>
                        <strong class="tick">0</strong> re-renders. Scratch
                        box keeps focus:${NBSP}
                        <input class="scratch" aria-label="scratch"
                            placeholder="type here">
                    </span>
                </template>
            </${RenderDemo.TAG}>
        </section>`
}

export function render ():string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="index.css">
    <title>microtags example</title>
    <noscript>
        <style>
            my-counter, count-button, copy-btn, subscribe-form,
            render-demo {
                display: initial!important;
            }
        </style>
    </noscript>
</head>

<body>
    <main>
        <h1>microtags example</h1>
${renderCounter()}
${renderSubscribeForm()}
${renderRenderDemo()}
    </main>
    <script type="module" src="./index.ts"></script>
</body>

</html>
`
}

process.stdout.write(render())
