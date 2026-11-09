// Calls a render static with no templater and no support import.
import { define } from 'microtags'

const X = define('x-throws').render(() => '<p></p>').setup(() => {})
try {
    console.log('rendered', X.render({}))
} catch (err) {
    console.log('threw', (err as Error).message)
}
