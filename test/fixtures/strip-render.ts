import { define } from 'microtags'

const Counter = define('test-counter')
    .render(() => '<p>count</p>')
    .setup(() => {})

export { Counter }
