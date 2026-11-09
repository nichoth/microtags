// The side-effect subpath: importing it fills core's internal slot.
import { _setRender } from './render-hook.js'
import { renderStatic } from './render-static.js'

_setRender(renderStatic)
