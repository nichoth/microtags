// .size-limit.js
export default [
    {
        name: 'microtags',
        path: 'dist/index.min.js',
        // measured 3.96 kB with server render support moved out of
        // core (ADR-009) and the typed bind helper; 3.99 kB with the
        // renderParts static, rounded up to the next 0.05 kB
        limit: '4 kB',
    },
    {
        name: 'microtags/htm',
        path: 'dist/htm.min.js',
        limit: '5 kB',
    },
    {
        name: 'microtags/htm (browser)',
        path: 'dist/htm.browser.min.js',
        // measured 4.77 kB after the guarded moveBefore, the duplicate
        // key check, raw() span adoption, the Markup brand symbol and
        // the void-element children check; 4.82 kB after the
        // attribute name guard; 4.94 kB with form controls bound as
        // DOM properties; 4.99 kB with the adoption mismatch
        // lookahead; 5.25 kB carrying the server render support
        // module (ADR-009); 5.29 kB with adopted controls compared
        // against the server value; 5.31 kB with the lookahead held
        // inside its range; 5.39 kB with render support building the
        // host tag from render parts, rounded up to the next 0.05 kB
        limit: '5.4 kB',
    },
    {
        name: 'microtags/preact (browser)',
        path: 'dist/preact.browser.min.js',
        // measures the adapter alone (preact is a peer); measured
        // 585 B, rounded up to the next 0.05 kB
        ignore: ['preact'],
        limit: '600 B',
    },
]
