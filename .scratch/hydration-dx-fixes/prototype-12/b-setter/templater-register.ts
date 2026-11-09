// Templaters inside the package register through the internal slot, so
// the standalone templater bundle does not pull in core's whole entry.
import { _setRender } from './render-hook.js'
import { renderStatic } from './render-static.js'

_setRender(renderStatic)
