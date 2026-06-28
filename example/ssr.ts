import { myCounter } from './index.js'
import { CopyBtn } from './copy-button.js'
import { CountBtn } from './count-button.js'

// example of using `.TAG` and `.refs` for serverside rendering

const START = 5

export function render ():string {
    return `
    <div>
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
                ></${CopyBtn.TAG}>

                <${CountBtn.TAG}
                    class="inc"
                    data-ref="${myCounter.refs.inc}"
                    aria-label="Increment"
                >
                    <button>+</button>
                </${CountBtn.TAG}>
            </div>
        </${myCounter.TAG}>
    </div>
    `
}

process.stdout.write(render())
