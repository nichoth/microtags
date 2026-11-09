// The module-level hook: a registry symbol on globalThis. Core reads it
// when render is called, so neither side imports the other.
import { renderStatic } from './render-static.js'

;(globalThis as any)[Symbol.for('microtags.render')] = renderStatic
