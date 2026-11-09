import type { Serialized, Signal } from 'microtags'
import { signal } from 'alien-signals'

export interface AppState {
    route:Signal<string>;
    count:Signal<number>;
    noticeOpen:Signal<boolean>;
    labels:Signal<string[]>;
    heading:Signal<string>;
    badgeLabel:Signal<string>;
}

export const DEFAULT_COUNT = 5

/** Id of the JSON script that carries the state to the browser. */
export const STATE_ID = 'microtags-state'

/**
 * Build the app state. Missing keys get defaults. Write to the signals
 * only through the static functions below.
 */
export function State (input:Partial<Serialized<AppState>> = {}):AppState {
    return {
        route: signal(input.route ?? '/'),
        count: signal(input.count ?? DEFAULT_COUNT),
        noticeOpen: signal(input.noticeOpen ?? false),
        labels: signal(input.labels ?? ['alpha', 'beta', 'gamma']),
        heading: signal(input.heading ?? 'Counter with nested badge'),
        badgeLabel: signal(input.badgeLabel ?? 'nested'),
    }
}

State.increase = function (state:AppState):void {
    state.count(state.count() + 1)
}

State.decrease = function (state:AppState):void {
    state.count(state.count() - 1)
}

State.openNotice = function (state:AppState):void {
    state.noticeOpen(true)
}

State.dismissNotice = function (state:AppState):void {
    state.noticeOpen(false)
}

State.addLabel = function (state:AppState, label:string):void {
    state.labels([...state.labels(), label])
}

State.removeLabel = function (state:AppState, label:string):void {
    state.labels(state.labels().filter(l => l !== label))
}

/** The plain JSON form of the state. */
export function serialize (state:AppState):Serialized<AppState> {
    return {
        route: state.route(),
        count: state.count(),
        noticeOpen: state.noticeOpen(),
        labels: state.labels(),
        heading: state.heading(),
        badgeLabel: state.badgeLabel(),
    }
}
