import { Hono, type Context } from 'hono'
import type { Serialized } from 'microtags'
import {
    assemble,
    stateScript,
    type ScaffoldLoader,
} from './scaffold.js'
import { State, serialize, type AppState } from '../state.js'
import { Layout, PREFIX } from '../pages/layout.js'
import { pageFor, NOT_FOUND_ROUTE } from '../pages/routes.js'

export { PREFIX }

export interface AppOptions {
    loadScaffold:ScaffoldLoader;
}

export function createApp (opts:AppOptions):Hono {
    const app = new Hono()

    async function page (state:AppState):Promise<string> {
        const body = pageFor(state.route())(state)
        return assemble(
            await opts.loadScaffold(),
            String(Layout(state, body)),
            stateScript(serialize(state))
        )
    }

    const index = async (c:Context) => {
        const state = stateFor(c, { count: countParam(c.req.query('count')) })
        return c.html(await page(state))
    }

    app.get(PREFIX, c => c.redirect(`${PREFIX}/`))
    app.get(`${PREFIX}/`, index)
    // the HTML entry's own path must never return the raw scaffold
    app.get(`${PREFIX}/index.html`, index)
    app.get(`${PREFIX}/list`, async c => c.html(await page(stateFor(c))))
    app.get(`${PREFIX}/notice`, async c => c.html(await page(stateFor(c))))

    app.notFound(async c => c.html(await page(stateFor(c)), 404))

    return app
}

/**
 * State for a request: `route` is the path without the prefix (`/` for
 * the HTML entry), or the not-found route for a path outside it.
 */
function stateFor (
    c:Context,
    input:Partial<Serialized<AppState>> = {}
):AppState {
    const path = c.req.path
    const route = path === `${PREFIX}/index.html` ?
        '/' :
        path.startsWith(PREFIX + '/') ?
            path.slice(PREFIX.length) :
            NOT_FOUND_ROUTE
    return State({ ...input, route })
}

/** A finite integer, or `undefined` so the default applies. */
function countParam (raw:string|undefined):number|undefined {
    if (raw === undefined || !/^-?\d+$/.test(raw.trim())) return undefined
    const n = Number(raw)
    return Number.isSafeInteger(n) ? n : undefined
}
