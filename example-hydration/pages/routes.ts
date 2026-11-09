import type { Markup } from 'microtags/htm'
import type { AppState } from '../state.js'
import { IndexPage } from './index.js'
import { ListPage } from './list.js'
import { NoticePage } from './notice.js'
import { NotFoundPage } from './not-found.js'

export { IndexPage, ListPage, NoticePage, NotFoundPage }

export type Page = (state:AppState) => Markup

/** Route (path without the prefix) to page. Shared by both sides. */
export const ROUTES:Record<string, Page> = {
    '/': IndexPage,
    '/list': ListPage,
    '/notice': NoticePage,
}

/** Route given to any path outside the prefix. Not in `ROUTES`. */
export const NOT_FOUND_ROUTE = '/404'

/** The page for a route, or the not-found page. */
export function pageFor (route:string):Page {
    return Object.hasOwn(ROUTES, route) ? ROUTES[route] : NotFoundPage
}
