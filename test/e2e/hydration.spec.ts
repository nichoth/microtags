import { test, expect, type Page } from '@playwright/test'

const PREFIX = '/example-hydration'

const ROUTES:{ path:string, hosts:string[] }[] = [
    { path: `${PREFIX}/`, hosts: ['hydra-counter', 'hydra-badge'] },
    { path: `${PREFIX}/list`, hosts: ['hydra-badge'] },
]

test.describe('server markup without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    for (const route of ROUTES) {
        test(`hosts have children at ${route.path}`, async ({ page }) => {
            const res = await page.goto(route.path)
            expect(res?.status()).toBe(200)
            for (const tag of route.hosts) {
                const hosts = page.locator(tag)
                expect(await hosts.count()).toBeGreaterThan(0)
                for (const host of await hosts.all()) {
                    expect(await host.locator('> *').count())
                        .toBeGreaterThan(0)
                }
            }
        })
    }

    test('notice route renders its button, no notice', async ({ page }) => {
        const res = await page.goto(`${PREFIX}/notice`)
        expect(res?.status()).toBe(200)
        await expect(page.locator('#show-notice')).toHaveCount(1)
        await expect(page.locator('hydra-notice')).toHaveCount(0)
    })
})

async function stateCount (page:Page):Promise<number> {
    const json = await page.locator('#microtags-state').textContent()
    return JSON.parse(json ?? '{}').count
}

test('counter starts from the server state and follows it', async ({
    page,
}) => {
    await page.goto(`${PREFIX}/?count=12`)
    const start = await stateCount(page)
    expect(start).toBe(12)
    const badge = page.locator('hydra-counter hydra-badge.number')
    await expect(badge).toHaveText(String(start))

    const host = await page.locator('hydra-counter').elementHandle()
    await page.getByRole('button', { name: 'Increment' }).click()
    await expect(badge).toHaveText(String(start + 1))
    const same = await page.locator('hydra-counter')
        .evaluate((el, before) => el === before, host)
    expect(same).toBe(true)

    await page.getByRole('button', { name: 'Decrement' }).click()
    await page.getByRole('button', { name: 'Decrement' }).click()
    await expect(badge).toHaveText(String(start - 1))
})

test('loading the page creates no duplicate hosts', async ({ page }) => {
    await page.goto(`${PREFIX}/`)
    await expect(page.locator('hydra-counter')).toHaveCount(1)
    await expect(page.locator('hydra-counter hydra-badge.number'))
        .toHaveCount(1)
})

test('client bundle keeps Badge.render and strips Counter.render', async ({
    page,
}) => {
    await page.goto(`${PREFIX}/`)
    const items = page.locator('#assertion-results li')
    await expect(items.first()).toBeVisible()
    const texts = await items.allTextContents()
    expect(texts.some(x => /Counter\.render is removed/.test(x)))
        .toBe(true)
    expect(texts.some(x => /Badge\.render is a function/.test(x)))
        .toBe(true)
})

test('notice opens, dismisses, and opens again', async ({ page }) => {
    await page.goto(`${PREFIX}/notice`)
    const notice = page.locator('hydra-notice')
    await expect(notice).toHaveCount(0)
    await page.locator('#show-notice').click()
    await expect(notice).toHaveCount(1)
    await notice.locator('button').click()
    await expect(notice).toHaveCount(0)
    await page.locator('#show-notice').click()
    await expect(notice).toHaveCount(1)
})

test('nav links reach every route', async ({ page }) => {
    await page.goto(`${PREFIX}/`)
    const links = page.locator('nav a')
    const hrefs = await links.evaluateAll(
        els => els.map(a => a.getAttribute('href') ?? '')
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
        await page.goto(`${PREFIX}/`)
        const [res] = await Promise.all([
            page.waitForResponse(r => new URL(r.url()).pathname === href),
            page.locator(`nav a[href="${href}"]`).click(),
        ])
        expect(res.status()).toBe(200)
        expect(new URL(page.url()).pathname).toBe(href)
    }
})

for (const path of ['/', '/notice']) {
    test(`runtime assertions contain no FAIL at ${path}`, async ({
        page,
    }) => {
        await page.goto(PREFIX + path)
        const items = page.locator('#assertion-results li')
        await expect(items.first()).toBeVisible()
        expect(await items.count()).toBeGreaterThan(0)
        for (const text of await items.allTextContents()) {
            expect(text.startsWith('FAIL')).toBe(false)
        }
    })
}

test('no request loads code from Hono', async ({ page }) => {
    const urls:string[] = []
    page.on('request', req => { urls.push(req.url()) })
    for (const path of ['/', '/list', '/notice']) {
        await page.goto(PREFIX + path, { waitUntil: 'networkidle' })
    }
    const scripts:string[] = []
    for (const url of urls.filter(u => /\.m?js(\?|$)/.test(u))) {
        const res = await page.request.get(url)
        scripts.push(await res.text())
    }
    expect(scripts.length).toBeGreaterThan(0)
    expect(urls.filter(u => /hono/i.test(u))).toEqual([])
    for (const src of scripts) {
        expect(/hono/i.test(src)).toBe(false)
    }
})

test('list adopts, adds, and removes keyed badges', async ({ page }) => {
    await page.route(/\.m?js(\?|$)/, route => route.abort())
    await page.goto(`${PREFIX}/list`)
    const serverCount = await page.locator('hydra-badge').count()
    await page.unroute(/\.m?js(\?|$)/)

    await page.goto(`${PREFIX}/list`)
    const items = page.locator('.badge-list li')
    const badges = page.locator('.badge-list hydra-badge')
    await expect(badges).toHaveCount(serverCount)

    const first = await badges.first().elementHandle()
    await page.locator('#add-label').click()
    await expect(badges).toHaveCount(serverCount + 1)
    expect(await badges.first().evaluate((el, h) => el === h, first))
        .toBe(true)

    const key = await items.nth(1).getAttribute('key')
    await items.nth(1).locator('button').click()
    await expect(badges).toHaveCount(serverCount)
    await expect(page.locator(`.badge-list li[key="${key}"]`))
        .toHaveCount(0)
    expect(await badges.first().evaluate((el, h) => el === h, first))
        .toBe(true)

    const results = page.locator('#assertion-results li')
    await expect(results.first()).toBeVisible()
    for (const text of await results.allTextContents()) {
        expect(text.startsWith('FAIL')).toBe(false)
    }
})

test('the page is visible when no script loads', async ({ page }) => {
    await page.route(/\.m?js(\?|$)/, route => route.abort())
    await page.goto(`${PREFIX}/`, { waitUntil: 'load' })
    const opacity = await page.evaluate(
        () => getComputedStyle(document.documentElement).opacity
    )
    expect(Number(opacity)).not.toBe(0)
})

interface Change { type:string, inBadge:boolean, attr:string|null }

/**
 * Start a MutationObserver on the whole document when it becomes
 * interactive (before the deferred module script runs), and return
 * the mutations seen once the client has mounted.
 */
async function hydrationChanges (
    page:Page,
    path:string
):Promise<Change[]> {
    await page.addInitScript(() => {
        const w = window as unknown as { _seen?:MutationRecord[] }
        document.addEventListener('readystatechange', () => {
            if (document.readyState !== 'interactive') return
            const seen:MutationRecord[] = w._seen = []
            new MutationObserver(recs => { seen.push(...recs) }).observe(document.documentElement, {
                attributes: true,
                childList: true,
                characterData: true,
                subtree: true,
            })
        })
    })
    await page.goto(PREFIX + path, { waitUntil: 'load' })
    await expect(page.locator('#assertion-results li').first())
        .toBeVisible()
    // let queued tasks (timers, promise callbacks) after mount run
    await page.evaluate(
        () => new Promise(resolve => setTimeout(resolve, 100))
    )
    return page.evaluate(() => {
        const w = window as unknown as { _seen?:MutationRecord[] }
        if (!w._seen) throw new Error('observer never started')
        const results = document.getElementById('assertion-results')
        return w._seen
            .filter(r => !results?.contains(r.target))
            .map(r => {
                const el = r.target instanceof Element ?
                    r.target :
                    r.target.parentElement
                return {
                    type: r.type,
                    inBadge: Boolean(el?.closest('hydra-badge')),
                    attr: r.attributeName,
                }
            })
    })
}

test('hydrating /list replaces no text inside badges', async ({
    page,
}) => {
    const changes = await hydrationChanges(page, '/list')
    expect(changes.filter(c => c.inBadge && c.type !== 'attributes'))
        .toEqual([])
})

test('hydrating /list writes no attributes', async ({ page }) => {
    const changes = await hydrationChanges(page, '/list')
    expect(changes.filter(c => c.type === 'attributes')).toEqual([])
})
