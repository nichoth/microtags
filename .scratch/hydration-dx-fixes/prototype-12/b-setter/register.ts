// What a templater or the transform writes under the setter variant:
// import the setter from core's public entry and pass it the support.
import { setRenderSupport } from './index.js'
import { renderStatic } from './render-static.js'

setRenderSupport(renderStatic)
