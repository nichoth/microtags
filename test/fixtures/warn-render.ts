import { define } from 'microtags'

const El = define('test-warn')
    .render(() => '<p>hi</p>')
    .setup(() => {})

const other = { render: (x:any) => x }
other.render(123)

export { El }
