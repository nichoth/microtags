import { defineConfig } from 'vite'
import { microtags } from '../../../src/vite.js'

// imports the plugin from source, which Vite's config bundler breaks
export default defineConfig({
    plugins: [microtags()],
})
