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
  layerDescriptors,
  elevationLayerId = ELEVATION_LAYER_ID,
} = {}) {
  const descriptors = ref([])
  const descriptors2D = computed(() => [...descriptors.value].sort((a, b) => a.order - b.order))
  const descriptors3D = computed(() => elevationLayerId ? [
    ...descriptors2D.value,
    { id: elevationLayerId, type: 'elevation', visible: true, opacity: 1, order: 0, source: { layer: elevationLayerId } },
  ] : [...descriptors2D.value])
  const layers2D = computed(() => descriptors2D.value.map(({ id }) => id))
  const layers3D = computed(() => descriptors3D.value.map(({ id }) => id))
  const ids = computed({
    get: () => [...layers2D.value],
    set: (values) => {
      const next = [...new Set(values)].filter((id) => id !== elevationLayerId).map((id, order) =>
        normalizeLayerDescriptor({ ...descriptors.value.find((layer) => layer.id === id), id, order }, order))
      descriptors.value = next
    },
  })

  function addLayer(layer) {
    const order = Math.max(-1, ...descriptors.value.map((layer) => layer.order)) + 1
    const descriptor = normalizeLayerDescriptor(layer, order)
    if (descriptor.id !== elevationLayerId && !descriptors.value.some(({ id }) => id === descriptor.id)) {
      descriptors.value.push(descriptor)
    }
  }

  function removeLayer(id) {
    descriptors.value = descriptors.value.filter((layer) => layer.id !== id)
  }

  function updateLayer(id, changes) {
    const index = descriptors.value.findIndex((layer) => layer.id === id)
    if (index < 0) throw new Error(`Couche inconnue : ${id}`)
    if (changes.id !== undefined && changes.id !== id) throw new Error("L'identifiant de couche ne peut pas changer")
    descriptors.value[index] = normalizeLayerDescriptor({ ...descriptors.value[index], ...changes }, index)
  }

  function reorderLayers(orderedIds) {
    if (orderedIds.length !== descriptors.value.length || new Set(orderedIds).size !== orderedIds.length ||
      orderedIds.some((id) => !descriptors.value.some((layer) => layer.id === id))) {
      throw new Error("L'ordre doit contenir chaque couche partagee exactement une fois")
    }
    descriptors.value = orderedIds.map((id, order) => ({
      ...descriptors.value.find((layer) => layer.id === id), order,
    }))
  }

  for (const layer of layerDescriptors ?? layerIds) addLayer(layer)

  return {
    layerDescriptors: descriptors, descriptors2D, descriptors3D,
    layerIds: ids, layers2D, layers3D, addLayer, removeLayer, updateLayer, reorderLayers,
  }
}

function normalizeLayerDescriptor(layer, order) {
  const input = typeof layer === 'string' ? { id: layer } : layer
  if (!input || typeof input.id !== 'string' || !input.id.trim()) throw new Error('Identifiant de couche invalide')
  if (input.source !== undefined && (!input.source || typeof input.source !== 'object' || Array.isArray(input.source))) {
    throw new Error(`Source de couche invalide : ${input.id}`)
  }
  const descriptor = {
    type: 'WMTS', visible: true, opacity: 1, order,
    ...input,
    source: { layer: input.id, ...input.source },
  }
  if (typeof descriptor.type !== 'string' || !descriptor.type ||
    typeof descriptor.visible !== 'boolean' ||
    !Number.isFinite(descriptor.opacity) || descriptor.opacity < 0 || descriptor.opacity > 1 ||
    !Number.isFinite(descriptor.order) ||
    typeof descriptor.source.layer !== 'string' || !descriptor.source.layer.trim()) {
    throw new Error(`Descripteur de couche invalide : ${input.id}`)
  }
  return descriptor
}

export function getLayerDescriptors(layers, mode) {
  return layers[`descriptors${mode}`] ??
    layers[`layers${mode}`].map((id, order) => normalizeLayerDescriptor(id, order))
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
