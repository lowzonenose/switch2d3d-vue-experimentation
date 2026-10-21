import { computed, reactive, ref } from 'vue'

export const ELEVATION_LAYER_ID = 'ELEVATION.ELEVATIONGRIDCOVERAGE'

export function createViewState({ coordinates = { longitude: 2.3465, latitude: 48.88 }, zoom = 10 } = {}) {
  const position = ref({ ...coordinates })
  const level = ref(zoom)

  function setView(coordinates, zoom) {
    if (Math.abs(position.value.longitude - coordinates.longitude) > 1e-7 ||
        Math.abs(position.value.latitude - coordinates.latitude) > 1e-7) {
      position.value = { longitude: coordinates.longitude, latitude: coordinates.latitude }
    }
    if (Math.abs(level.value - zoom) > 1e-6) level.value = zoom
  }

  return { coordinates: position, zoom: level, setView }
}

export function createLayersState({
  layerIds = ['ORTHOIMAGERY.ORTHOPHOTOS', 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'],
  elevationLayerId = ELEVATION_LAYER_ID,
} = {}) {
  const ids = ref([...layerIds])
  const layers2D = computed(() => [...new Set(ids.value)].filter((id) => id !== elevationLayerId))
  const layers3D = computed(() => elevationLayerId ? [...layers2D.value, elevationLayerId] : [...layers2D.value])

  function addLayer(id) {
    if (id && id !== elevationLayerId && !ids.value.includes(id)) ids.value.push(id)
  }

  function removeLayer(id) {
    ids.value = ids.value.filter((layerId) => layerId !== id)
  }

  return { layerIds: ids, layers2D, layers3D, addLayer, removeLayer }
}

export function createControlsState({ controlIds = ['LayerSwitcher', 'Scale', 'MousePosition'] } = {}) {
  const ids = ref([...controlIds])
  const controls2D = computed(() => [...new Set(ids.value)])
  const controls3D = computed(() => [...new Set(ids.value)])

  function addControl(id) {
    if (id && !ids.value.includes(id)) ids.value.push(id)
  }

  return { controlIds: ids, controls2D, controls3D, addControl }
}

export function createMapState({ elevationLayerId = ELEVATION_LAYER_ID, ...options } = {}) {
  return {
    view: reactive(createViewState(options)),
    layers: reactive(createLayersState({ ...options, elevationLayerId })),
    controls: reactive(createControlsState(options)),
    elevationLayerId,
  }
}
