import { onBeforeUnmount } from 'vue'
import { createMap3D } from '../features/createMap3D.js'

/**
 * Hook pour utiliser une carte 3D avec Vue.js.
 * Il crée et gère le cycle de vie de la carte 3D.
 *
 * @param {Object} options - Les options pour créer la carte 3D.
 * @returns {Object} Un objet contenant les méthodes pour interagir avec la carte 3D.
 * @example
 * const map3D = useMap3D({
 *   layers: { layers3D: ['layer1', 'layer2'] },
 *   controls: {},
 *   view: { center: new Coordinates('EPSG:4326', 0, 0), zoom: 2 },
 *   elevationLayerId: 'elevationLayer'
 * })
 * map3D.load(document.getElementById('map3d'))
 * // Pour nettoyer la carte 3D
 * map3D.dispose()
 */
export function useMap3D(options) {
  const controller = createMap3D(options)
  onBeforeUnmount(controller.dispose)
  return controller
}
