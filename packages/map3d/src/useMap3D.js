import { onBeforeUnmount } from 'vue'
import { createMap3D } from './createMap3D.js'

export function useMap3D(options) {
  const controller = createMap3D(options)
  onBeforeUnmount(controller.dispose)
  return controller
}
