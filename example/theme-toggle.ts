import { signal } from 'alien-signals'
import { define } from '../src/index.js'
import { createContext, provide } from '../src/context.js'

// One context token, shared by the provider and its consumers.
// createContext takes no name; identity is the symbol it holds.
export const ThemeToken = createContext<string>()

/**
 * Provider: owns a light/dark value and shares it with descendants.
 *
 * The `theme` attribute seeds only the initial value, so the same
 * component can start "light" at the top level and "dark" when nested.
 * The toggle uses a scoped `:scope > button` selector so each provider
 * binds only its OWN direct-child button -- refs query the whole subtree,
 * so a bare 'button' would also match a nested provider's toggle.
 */
export const ThemeProvider = define('theme-provider')
    .withProps(p => ({
        theme: p.string(),  // 'light' | 'dark'; '' when the attr is absent
    }))
    .withRefs(r => ({
        toggle: r.one(':scope > button'),  // this provider's own toggle
    }))
    .setup(ctx => {
        const theme = signal(ctx.props.theme() || 'light')

        // Seed the shared signal; the returned cleanup removes this host's
        // entry on disconnect.
        const rmContext = provide(ctx.host, ThemeToken, theme())
        ctx.onCleanup(rmContext)

        // Re-provide on change. provide() updates the existing signal in
        // place, so consumers reading this value re-run.
        ctx.effect(() => {
            provide(ctx.host, ThemeToken, theme())
        })

        ctx.on(ctx.refs.toggle, 'click', () => {
            theme(theme() === 'light' ? 'dark' : 'light')
        })
    })

/**
 * Consumer: reads the nearest provider's theme and reflects it onto its
 * own `data-theme`, which the stylesheet keys off. Reading
 * ctx.contexts.theme inside an effect subscribes to the nearest provider,
 * so this re-runs whenever that provider toggles.
 */
export const ThemedCard = define('themed-card')
    .withContexts(() => ({
        theme: ThemeToken,
    }))
    .setup(ctx => {
        ctx.effect(() => {
            ctx.host.dataset.theme = ctx.contexts.theme
        })
    })
