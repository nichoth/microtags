import { signal } from 'alien-signals'
import { define } from '../src/index.js'
import { render, renderList } from '../src/render.js'

/**
 * Demonstrates that keyed rendering preserves browser-held DOM state.
 *
 * Each row holds an <input>. The list re-renders on a one-second tick and
 * reorders on Shuffle, yet the text you typed survives both: rows are
 * matched by `key`, so renderList reuses the existing <li> (moving it at
 * most) instead of recreating it, and `update` only ever writes the label.
 * Across the constant tick re-renders an unchanged row is left untouched,
 * so its <input> even keeps its focus and caret. (Reordering moves the
 * node, which the browser treats as a blur, but the typed value rides
 * along.)
 *
 * The summary line uses `render` (the single-item helper): it keys on the
 * template, so each tick updates the same element in place. The scratch
 * <input> living inside it keeps its focus and text across every re-render.
 *
 * Depends on pre-rendered HTML: a <ul>, a Shuffle <button>, a row
 * <template>, a summary <p>, and a summary <template>.
 */
type Row = { id:string; label:string }

export const RenderDemo = define('render-demo')
    .withRefs(r => ({
        list: r.one('ul'),
        shuffle: r.one(),  // matches [data-ref="shuffle"]
        rowTpl: r.one<HTMLTemplateElement>(),  // [data-ref="rowTpl"]
        summary: r.one(),  // the single-item render container
        summaryTpl: r.one<HTMLTemplateElement>(),  // [data-ref="summaryTpl"]
    }))
    .setup(ctx => {
        const rows = signal<Row[]>([
            { id: 'a', label: 'Row A' },
            { id: 'b', label: 'Row B' },
            { id: 'c', label: 'Row C' },
            { id: 'd', label: 'Row D' },
        ])

        // A counter that ticks every second. Both effects read it, so they
        // re-run constantly. Surviving one re-render could be luck; surviving
        // a tick every second proves the nodes are reused, not recreated.
        const ticks = signal(0)
        const timer = setInterval(() => ticks(ticks() + 1), 1000)
        ctx.onCleanup(() => clearInterval(timer))

        // Keyed list. Re-runs on every tick and every shuffle. On a pure
        // tick the order and item identities are unchanged, so renderList
        // touches nothing. On a shuffle the keys are stable, so each <li>
        // is moved into place with its <input> intact.
        ctx.effect(() => {
            ticks()  // subscribe so a tick forces this effect to re-run
            renderList<Row, HTMLLIElement>(ctx.refs.list, ctx.refs.rowTpl, {
                data: rows(),
                key: row => row.id,
                update: (el, row) => {
                    el.querySelector('.label')!.textContent = row.label
                },
            })
        })

        // Single-item panel. render() keys on the template, so each call
        // updates the same <span> in place. The tick count changes every
        // second, but the scratch <input> keeps its focus and text.
        ctx.effect(() => {
            render<number, HTMLElement>(ctx.refs.summary, ctx.refs.summaryTpl, {
                data: ticks(),
                update: (el, n) => {
                    el.querySelector('.tick')!.textContent = String(n)
                },
            })
        })

        // Reorder the data without changing any keys. The row you are
        // editing rotates to its new position carrying its input value.
        ctx.on(ctx.refs.shuffle, 'click', () => {
            const next = rows().slice()
            next.push(next.shift()!)
            rows(next)
        })
    })
