import { defineConfig } from 'vite'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        global: 'globalThis'
    },
    // https://github.com/vitejs/vite/issues/8644#issuecomment-1159308803
    esbuild: {
        logOverride: {
            'this-is-undefined-in-esm': 'silent',
        }
    },
    publicDir: '_public',
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            targets: browserslistToTargets(browserslist('>= 0.25%')),
        },
    },
    server: {
        port: 8888,
        host: true,
        open: true,
    },
    resolve: {
        alias: {
            'microtags/htm': resolve(import.meta.dirname!, 'src/htm.ts'),
            microtags: resolve(import.meta.dirname!, 'src/index.ts'),
        },
    },
    build: {
        minify: false,
        outDir: 'public',
        emptyOutDir: true,
        sourcemap: 'inline',
        rollupOptions: {
            input: {
                main: resolve(
                    import.meta.dirname!,
                    'example/index.html'
                ),
            },
        },
    },
})
