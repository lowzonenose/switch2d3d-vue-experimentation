import { reactive } from 'vue'

export const ELEVATION_LAYER_ID = 'ELEVATION.ELEVATIONGRIDCOVERAGE'

// Etat cartographique minimal appartenant a l'application hote, conforme au
// contrat de la prop `options` decrit dans le README de la bibliotheque.
// Les identifiants de `layers3D` sont interpretes comme des couches WMTS du
// catalogue Geoplateforme ; `elevationLayerId` y identifie le relief.
export function createDemoMapState() {
  const view = reactive({
    coordinates: { longitude: 6.8652, latitude: 45.8326 },
    zoom: 12,
    setView({ longitude, latitude }, zoom) {
      view.coordinates = { longitude, latitude }
      view.zoom = zoom
    },
  })

  const layers = reactive({
    layers3D: ['ORTHOIMAGERY.ORTHOPHOTOS', ELEVATION_LAYER_ID],
    addLayer(layer) {
      const id = typeof layer === 'string' ? layer : layer.id
      if (id && !layers.layers3D.includes(id)) layers.layers3D.push(id)
    },
    removeLayer(id) {
      layers.layers3D = layers.layers3D.filter((layerId) => layerId !== id)
    },
  })

  const controls = reactive({
    controls3D: ['LayerSwitcher', 'Scale', 'MousePosition'],
  })

  return { view, layers, controls, elevationLayerId: ELEVATION_LAYER_ID }
}
