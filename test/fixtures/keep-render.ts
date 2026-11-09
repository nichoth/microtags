import { define } from 'microtags'

const Notice = define('test-notice')
    .render(() => '<p>notice</p>', { client: true })
    .setup(() => {})

export { Notice }
