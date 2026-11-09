# Adversarial review: hydration DX

Branch `wip-adding-hono-to-hydration-example` at 6675566, compared
against `origin/main` at 5669919. Reviewed 2026-10-13.

## Goals under review

1. Preserve the "SPA feeling" of unidirectional data flow: events up,
   state down.
2. Server-side render the same codebase.
3. The client can add interactivity to a server-rendered page.
4. The client does not re-render the page.
5. The client bundle is smaller than the full (server-side) bundle.

## Summary

The architecture is sound: adoption creates no element nodes and leaves
`innerHTML` byte-identical on every route tested. At HEAD, though, the
example does not build (finding 1, a one-line regression). The real
design gaps are findings 2, 3 and 7, where the server output and the
client's view of it drift apart. Finding 6 is a cheap guarantee worth
adding. Goal 5 needs a decision: restructure core so stripping removes
the server-render code, or accept that stripping is marginal and update
ADR-005 to say so.

## Verification

All commands ran in a review worktree of the branch. No tracked files
were edited there.

1. `npm ci` exited 1: there is no `package-lock.json`. `npm install
   --no-audit --no-fund` was used instead (exit 0, 342 packages).
2. `npm run build`: exit 0.
3. `npm test`: exit 0, 286/286 (runs `typecheck` first).
4. `npm run test:ssr`: exit 0, 79/79.
5. `npm run test:build`: exit 0, 33/33.
6. `npm run test:plugins`: exit 0, 13/13.
7. `npm run test:cli`: exit 0, 23/23.
8. `npm run typecheck` and `npm run typecheck:hydration`: exit 0.
9. `npm run lint`: exit 0. `example-hydration/build/` did not exist,
   because the hydration build failed.
10. `npm run build:hydration`: exit 1. `failed to load config from
    .../example-hydration/vite.config.ts ... Error: microtags/build
    requires "typescript" as a peer dependency.`
11. `npm run test:hydration`: exit 1, same error (its first step is
    `build:hydration`).
12. `npm run test:hydration-dev`: exit 1, 0/6. First failure is the same
    peer-dependency error; the rest fail with `Failed to parse URL from
    undefined/example-hydration/`.
13. `npx playwright test` (`test:e2e`): exit 1. `Process from
    config.webServer was not able to start. Exit code: 1`.
14. In a scratch copy with finding 1 fixed:
    - `build:hydration`: exit 0.
    - `test:hydration`: exit 0, 114/114, plus 17/17 for listen.
    - `test:hydration-dev`: exit 0, 17/17.
    - `playwright test`: exit 0, 12 passed (Chromium was available).
15. `npx size-limit` on `dist/`:
    - core 4.17 kB (limit 4.2 kB)
    - `microtags/htm` 1.43 kB (limit 5 kB)
    - `microtags/htm` browser 4.56 kB (limit 4.6 kB)
    - baseline `origin/main` core: 3.48 kB (limit 3.5 kB)
16. `npm run ssr:hydration -- /list`: exit 0, with correct-looking
    output and state script.

## Bundle sizes

Measured on the patched copy with Vite 8.3.4. The stripping-off variant
uses a scratch config with the `microtags()` plugin set to `null`.

| Bundle | Minified | gzip | Unminified |
|---|---|---|---|
| Client, stripping on (as shipped) | 23,113 B | 8.66 kB | 45.08 kB |
| Client, stripping off | 23.88 kB | 8.80 kB | 45.91 kB |
| Server `app.js` | not minified | 8,236 B | 26,087 B |
| Server `listen.js` | not minified | n/a | 896 B |

Stripping saves 0.77 kB minified (3.2%) and about 0.14 kB gzip (1.6%).
The unminified diff shows only Counter's render body and `raw()` were
removed.

Server `app.js` leaves `hono`, `alien-signals` and `htm` as external
imports, so comparing the 23 kB client to the 26 kB server is not like
for like. The strip on/off comparison is the meaningful one.

Largest pieces of the stripped client (unminified bytes per module):

- `src/htm.browser.ts` 10,921
- alien-signals 9,946
- `src/builders.ts` 5,597
- `src/factory.ts` 4,198
- `htm` 1,794
- all pages together, about 3,900

## Findings

Ordered most severe first. Each lists the goal it threatens.

### 1. Blocking (DX). The example's Vite config imports the plugin from source

`example-hydration/vite.config.ts:7`:

```ts
import { microtags } from '../src/vite.js'
```

Commit e9f75a0 changed this from `'../dist/vite.js'`. `src/build.ts:7`
calls `require('typescript')`. In Vite's ESM config bundle `require` is
undefined, the catch fires, and it throws the misleading peer-dependency
error even though TypeScript is installed. AGENTS.md documents this
exact hazard.

This breaks `start:hydration`, `build:hydration`, `test:hydration`,
`test:hydration-dev` and `test:e2e`. Reverting the line makes all of them
pass.

Fix: revert to `'../dist/vite.js'`. Also make `build.ts` report that
`require` is unavailable (ESM context) when `typeof require ===
'undefined'`, instead of claiming TypeScript is missing.

### 2. Important (goals 2, 4). Server double-escapes attributes and stringifies booleans

`src/htm.ts:156`:

```ts
a += ` ${k}="${_escHtml(String(v))}"`
```

`v` is already an `_Escaped`, because `html()` wraps every interpolated
string, so it is escaped twice.

`src/htm.ts:125`:

```ts
attrs[k] = String(v)
```

`_renderHost` escapes this again, and `true`, `false` and `null` become
the strings `"true"`, `"false"` and `"null"`.

Probe: `` html`<a href=${'/x?a=1&b=2'} title=${'say "hi"'}>` `` plus a
host with `hidden=${true} data-off=${false} data-n=${null}
class=${'a&b'}`.

- Server output: `<a href="/x?a=1&amp;amp;b=2" title="say
  &amp;quot;hi&amp;quot;">` and `<p-tag label="l" hidden="true"
  data-off="false" data-n="null" class="a&amp;amp;b">`.
- Browser `String()` output: `href="/x?a=1&amp;b=2"` and `<p-tag
  label="l" hidden class="a&amp;b">`.

After `mount`, the client fixes `href` and `title`. Before JS runs, and
for crawlers, the link points to the wrong URL. Host attributes stay
wrong permanently, because `_bindHost` ignores non-prop attributes.

The example never hits this because no interpolated attribute contains
`&`, `<` or quotes, and `test/ssr.ts` does not cover it.

Fix: in both places, use `v instanceof _Escaped ? v._raw : v` before
escaping. Mirror the browser `_compArgs` rules: `true` becomes an empty
attribute, and `false`/`null` are omitted. Add an SSR round-trip test
against the browser `String()` output.

### 3. Important (goal 4). Adoption rewrites every static attribute

`src/htm.browser.ts:227` calls `_setAttr(el, k, v)` for static values,
and `_adopt` calls `_bindEl(n, v.p, offs)` (line 494).

Production probe with a MutationObserver started at `readyState ===
'interactive'`:

- `/` has 9 mutations, for example `attr href on <a>
  old="/example-hydration/" new="/example-hydration/"`.
- `/list` has 15, including `attr key on <li>` for each item.

Iframe probe: server `<iframe src="data:text/html,hi">`, then `mount`
gives `iframeLoadsBeforeMount: 1, iframeLoadsAfterMount: 1`. The iframe
re-navigates. `<video src>` and `<audio src>` also reload when `src` is
set.

Fix: when adopting, skip static attributes. Bind only function-valued
ones, and compare with `getAttribute` before writing.

### 4. Important (goals 3, 4). Adoption misaligns in two cases and leaves listeners unbound

Case (a): `raw()` HTML with several top-level nodes or whitespace between
them. `_items` pushes each parsed node (line 188). `_adopt` then steps
one DOM node per item after `_skip`, which skips whitespace and comments
(lines 456-460), so the counts drift.

Probe: `<div>${raw('<b>a</b>\n<i>b</i>')}<button onclick=...>` warns
`microtags: adopt: expected <button>, found none`, and the click handler
never fires.

Case (b): a kept component whose own render has a reactive hole before
`${children}`. `_range` (lines 311-329) takes the first `<!--[-->` in the
host, which is the render's own region, not the children range.

Probe: Wrap renders `<em>${() => ...}</em>${raw(children)}`. It warns
`expected <button>, found none`, and the child button's `onclick` is not
bound.

Fix:

- For (a), wrap `raw()` output in markers on both sides, or count raw
  nodes against the DOM without `_skip`.
- For (b), mark the children range distinctly (for example `<!--[c-->`),
  or locate it from the end.

### 5. Important (goal 1). Components can write the parent's state through a prop

`src/factory.ts:114`:

```ts
ext ? ext(args[0]) : own(args[0])
```

Once a signal is bound, `ctx.props.x(v)` writes into the page-owned
signal.

Probe: a component with `count` bound to `signal(5)` calls
`ctx.props.count(99)` after mount, and the page's signal becomes 99.

"Events up, state down" is therefore a convention, not a guarantee. If a
computed is bound, as Counter does for the Badge label, writes are
silently dropped.

Fix: make the wrapper read-only while bound. Ignore the write, or throw
in dev with "prop is bound; emit an event instead".

### 6. Important (goal 4). Server-only render inputs drift from the client

`example-hydration/server/app.ts:25-27` passes `opts.index` (heading and
label) only on the server. `client/index.ts:36` mounts
`pageFor(state.route())(state)` without it, and the value is not in the
serialized state.

Probe: server label `SERVER-ONLY`, then mount with the client default.
After hydration the span reads `nested`, with 1 childList mutation and no
warning, because `_adopt` never compares text (lines 473-477).

Fix: put such inputs in `AppState` and serialize them, or remove the
option. Optionally warn in dev when adopted text differs.

### 7. Important (goals 2, 4). The page is invisible until JS runs, and forever if it fails

`example-hydration/index.html:2`:

```html
<html lang="en" class="reduce-fouce">
```

`client/index.css:74` sets `html.reduce-fouce { opacity: 0; }`. The 2 s
fallback lives in JS (`client/util.ts`).

Probe with every `.js` request aborted: after 3 s, `html opacity = 0
class = reduce-fouce`. `<noscript>` only covers JavaScript being
disabled, not a failed load, a CSP block or an exception. This defeats
SSR as a fallback.

Fix: drop the opacity gate (adoption creates nothing, so there is no
flash to hide), or add a CSS-only animation that reveals the page after
N seconds without JS.

### 8. Important (goal 5). Stripping barely shrinks the client

The stripped client still contains `_renderHost`, `_serializerFor`,
`_sJson`, `_escAttr` and the `staticRender` wrapper from
`src/builders.ts`, plus `_str` and `_compArgs` from `htm.browser.ts`.
These are built inside `define()` and `Markup.toString`, so stripping a
user's `.render` can never remove them.

Core grew from 3.48 kB to 4.17 kB brotli (+20%), and the size limit was
raised from 3.5 kB to 4.2 kB. The browser templater is at 4.56 kB against
a 4.6 kB limit. Net effect in this example: 23.88 kB to 23.11 kB.

Fix: move static-render construction out of `define()`. For example,
have `.render()` attach the serializer lazily from a separate module, so
stripping `.render` also drops `_renderHost` and the serializers.
Measure again with all renders stripped.

### 9. Minor (goal 3). Mismatch recovery cascades, and the warning is not dev-only

On a tag mismatch, `_adopt` advances one DOM node (line 486), so one
extra server node misaligns every later sibling.

Probe: server `<h1><p><button>`, client `<p><button>`. Warnings:
`expected <p>, found <h1>` then `expected <button>, found <p>`, and the
button is left unbound.

`console.warn` at lines 466 and 482 is unconditional.

Fix: on a mismatch, look ahead for a matching tag before giving up. Gate
the warning behind a dev flag, or document that it always warns.

### 10. Minor (goal 4). Badge replaces its text node on every hydration

`components/badge.ts:19`:

```ts
ctx.refs.text.textContent = ctx.props.label()
```

Production probe on `/list`: `add text("alpha") in <span>` / `remove
text("alpha") from <span>` for each badge. `mount` itself creates no
element nodes on any route; the churn comes from the example's setup
pattern.

Fix: write only when the value changes (`if (el.textContent !== v)`),
and document the pattern.

### 11. Minor (correctness). Paths outside the prefix render real pages with a 404

`server/app.ts:57-61` maps any path that does not start with `PREFIX` to
`route = path`.

Probe through `app.request`:

- `/` returns 404 with `<h1>Counter with nested badge</h1>` and
  `"route":"/"`.
- `/list` returns 404 with `<h1>Badges from an array</h1>`.

In production `serveStatic` misses `/`, so this is what a visitor gets,
and the client then mounts an interactive page.

Fix: use `route = '/__not_found__'` (or skip `pageFor`) for paths outside
the prefix.

### 12. Minor (DX). Two copies of `Markup` render as escaped text with no error

`instanceof Markup` checks in `_items` and `_str` (`htm.browser.ts:103`,
`:187`).

Probe: `html` from `dist/htm.browser.js` mounted with `mount` from
`src/htm.browser.js` gives `&lt;p class="x"&gt;hi
&lt;b&gt;there&lt;/b&gt;&lt;/p&gt;`.

Fix: brand with `Symbol.for('microtags.markup')`, or throw in `mount`
when given a non-`Markup` object that has `_n`/`_h`.

### 13. Minor (DX). Stripping changes module evaluation order

Cascade removes `import { Badge }` from `counter.ts`. In the stripped
bundle the Badge `define` moves after Counter, so Counter's setup
(`ctx.refs.current.label = label`) runs against an un-upgraded
`<hydra-badge>`. It works only because of the pre-upgrade own-property
handling (`factory.ts:118-122`). A setup that calls a method on a nested
host ref would break in the stripped build only.

Fix: document this, have `client/index.ts` import leaf components first,
or keep side-effect imports when cascading.

### 14. Minor (DX). The binding API needs type casts and leaves stale attributes

`components/counter.ts:47`:

```ts
ctx.refs.current.label = label as unknown as string
```

After binding, host attributes (for example `count="12"`) stop updating.

Fix: a typed `bind(host, 'label', sig)` helper, or a `MicrotagHost`
setter type that accepts `Signal<T>`.

### 15. Minor (DX). Smaller issues

- No lockfile is committed, so `npm ci` is impossible and versions float
  (Vite 8.3.4 resolved against `^8.0.5`).
- `key` is emitted as a real DOM attribute (`<li key="alpha">`).
- `/index.html` gets no `aria-current`, because route `/index.html` is
  not equal to `/`.

## Docs that contradict the code

1. `AGENTS.md` and `example-hydration/README.md:36-37` say the config
   imports from `dist/vite.js`. It imports `../src/vite.js` (finding 1).
2. ADR-005 line 55 says "a browser bundle contains hydration code only".
   `_renderHost`, the serializers, `staticRender` and `_str` ship
   (finding 8).
3. ADR-005 line 64 says "The core size budget stays at 3.5 kB".
   `.size-limit.js` now allows 4.2 kB, and the measured size is 4.17 kB.
4. ADR-007 line 92 says "the core entry grows only by the prop
   accessors". It also grew by the serializer, `_renderHost` and the
   static render (+0.69 kB brotli).
5. ADR-007 line 85 says a mismatch "warns in development". The warning
   is unconditional, and the ADR omits that later siblings misalign
   (finding 9).
6. ADR-007 line 70 says adoption "binds, and creates no nodes". That
   holds for elements, but adoption rewrites every static attribute
   (finding 3).

## Verdict per goal

1. Events up, state down: partially met. The example follows the
   pattern, but the runtime lets components write the parent's state
   through bound props (finding 5).
2. Same code on both sides: partially met. Server attribute
   serialization differs from the browser's (finding 2), and server-only
   page options drift (finding 6).
3. Client adds interactivity: met in logic, broken at HEAD. All e2e and
   hydration tests pass once finding 1 is fixed. There are adoption gaps
   for `raw()` and for regions in a component's own render (finding 4).
4. No client re-render: partially met. No element nodes are created and
   `innerHTML` is unchanged on all six routes, but adoption rewrites
   every attribute, Badge replaces its text nodes, drifted values
   overwrite server text, and the page stays hidden until JS runs
   (findings 3, 6, 7, 10).
5. Client bundle smaller: technically met, marginal. 23.11 kB stripped
   against 23.88 kB unstripped (-3.2% minified, -1.6% gzip). Server-render
   code stays in core regardless of stripping (finding 8).
