# 01: Example build works from a fresh clone

**What to build:** An app author who clones the branch can run
`start:hydration`, `build:hydration` and every hydration test without
debugging the build. The example's Vite config loads the plugin from
the built Node entry again. When the `microtags/build` entry is loaded
where `require` is unavailable (an ESM context such as a Vite config
bundle), it throws an error saying the entry must be loaded from its
built form or that `require` is unavailable. The "install typescript"
message is kept only for a real resolution failure.

Source: spec section "Example build (finding 1)".

**Blocked by:** None (can start immediately)

**Touches:** `example-hydration/vite.config.ts` (plugin import),
`src/build.ts` (the `require('typescript')` guard), `test/build.ts`,
AGENTS.md and `example-hydration/README.md` (verify the config-import
note already matches; run `npm run toc:hydration` if the README
changes)

**Status:** done

- [x] `npm run build:hydration`, `npm run test:hydration`,
      `npm run test:hydration-dev` and `npm run test:e2e` exit zero
      from a fresh checkout after `npm run build`
- [x] Loading the build entry with `require` undefined throws an error
      that mentions `require` being unavailable or the built form, and
      does not say TypeScript is missing
- [x] A genuine failure to resolve `typescript` still throws the
      peer-dependency message
- [x] `npm run test:build` passes
