import { createMap2D } from '../maps/createMap2D'
import { useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'

let controller = null

export async function useLoad2D(mapId, layersStore = useLayersStore(), controlsStore = useControlsStore(), mapStore = useMapStore()) {
  useDispose2D()
  controller = createMap2D({ layers: layersStore, controls: controlsStore, view: mapStore })
  try {
    return await controller.load(mapId)
  } catch (cause) {
    console.error('Impossible de charger la carte 2D :', cause)
    useDispose2D()
  }
}
export function useDispose2D() {
  controller?.dispose()
  controller = null
}
