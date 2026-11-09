# 08: One gate script

**What to build:** A maintainer runs `npm run gate` and every check in
the repo runs in cost order, cheapest first: remove the example build
directory (ESLint lints it if present), lint, typecheck, build, size,
the browser suite, the SSR suite, the build suite, the plugins suite,
the CLI suite, the hydration suite, and the hydration dev-server test.
The hydration suite is last because it builds the example. Playwright
is not in the gate because it needs a one-time browser install; the
script's README entry says to run `test:e2e` separately. The AGENTS.md
note that both suites must stay green points at `gate`.

**Blocked by:** The hydration DX spec's example build fix
(`.scratch/hydration-dx-fixes/spec.md`, "Example build"). At HEAD
`example-hydration/vite.config.ts` imports the plugin from source, so
the hydration suite and dev-server test fail, and a gate that includes
them cannot be green. That spec is not yet ticketed; when it is, record
the ticket number here.

**Touches:** `package.json` (`scripts.gate`), `AGENTS.md` (the "Both
suites must stay green" sentence), the README that lists scripts
(`README.md` or `example-hydration/README.md`, followed by the matching
`toc` script). No tests, per the global rules on docs; the criterion
below is the script running.

**Status:** done

- [x] `npm run gate` exists and runs the listed scripts in the listed
      order, stopping on the first failure.
- [x] `npm run gate` passes on a clean checkout with `dist/` and the
      example build directory absent.
- [x] The README entry for `gate` says Playwright is run separately
      with `test:e2e`, and AGENTS.md points at `gate`.
