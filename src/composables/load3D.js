import { createMap3D } from '../maps/createMap3D'
import { ELEVATION_LAYER_ID, useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'

let controller = null

export async function useLoad3D(mapId, layersStore = useLayersStore(), controlsStore = useControlsStore(), mapStore = useMapStore()) {
  useDispose3D()
  const current = createMap3D({
    layers: layersStore,
    controls: controlsStore,
    view: mapStore,
    elevationLayerId: ELEVATION_LAYER_ID,
  })
  controller = current
  try {
    return await current.load(mapId)
  } catch (cause) {
    console.error('Impossible de charger le globe iTowns :', cause)
    if (controller === current) {
      console.error("Le globe n'a pas pu etre charge. Verifiez la connexion aux services Geoplateforme et la prise en charge de WebGL.")
      useDispose3D()
    }
  }
}

export function useDispose3D() {
  controller?.dispose()
  controller = null
}
