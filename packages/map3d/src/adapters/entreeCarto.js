const WMTS_SUFFIX = '$GEOPORTAIL:OGC:WMTS'
const DEFAULT_ELEVATION_LAYER_ID = 'ELEVATION.ELEVATIONGRIDCOVERAGE'
const DEFAULT_CONTROL_MAPPINGS = {
  LayerSwitcher: 'LayerSwitcher',
  MousePosition: 'MousePosition',
  Scale: 'Scale',
  ScaleLine: 'Scale',
}
const MAX_MERCATOR_LATITUDE = 85.0511287798066

function assertMapStore(mapStore) {
  const methods = ['getLayers', 'getLayerProperty', 'addLayer', 'removeLayer', 'updateLayerProperty', 'getControls']
  if (!mapStore || methods.some((method) => typeof mapStore[method] !== 'function')) {
    throw new TypeError(`Le store cartes.gouv.fr doit fournir : ${methods.join(', ')}`)
  }
  for (const property of ['lon', 'lat', 'zoom']) {
    if (!Number.isFinite(Number(mapStore[property]))) {
      throw new TypeError(`Valeur invalide dans mapStore.${property}`)
    }
  }
}

function parseWmtsId(id) {
  if (typeof id !== 'string' || !id.trim()) return null
  const separator = id.lastIndexOf('$')
  if (separator < 0) return null
  if (id.slice(separator + 1) !== 'GEOPORTAIL:OGC:WMTS') return null
  const layer = id.slice(0, separator)
  if (!layer.trim()) return null
  return { id: layer, storeId: id, layer }
}

function mercatorCoordinates(longitude, latitude) {
  const radius = 6378137
  const clampedLatitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude))
  return [
    radius * longitude * Math.PI / 180,
    radius * Math.log(Math.tan(Math.PI / 4 + clampedLatitude * Math.PI / 360)),
  ]
}

/**
 * Adapte le mapStore Pinia de cartes.gouv.fr-entree-carto au contrat de Map3D.
 * Seules les couches catalogue WMTS sont partagees avec le globe.
 */
export function createEntreeCartoAdapter({
  mapStore,
  elevationLayerId = DEFAULT_ELEVATION_LAYER_ID,
  controlMappings = {},
  ...mapOptions
} = {}) {
  assertMapStore(mapStore)

  const controlMap = { ...DEFAULT_CONTROL_MAPPINGS, ...controlMappings }

  function getWmtsLayers() {
    return mapStore.getLayers()
      .map(parseWmtsId)
      .filter(Boolean)
      .map((layer, index) => {
        const properties = mapStore.getLayerProperty(layer.storeId) ?? {}
        const position = Number(properties.position)
        return {
          ...layer,
          type: 'WMTS',
          visible: properties.visible ?? true,
          opacity: Number.isFinite(Number(properties.opacity)) ? Number(properties.opacity) : 1,
          order: Number.isFinite(position) && position >= 1 ? position - 1 : index,
        }
      })
      .sort((a, b) => a.order - b.order)
  }

  function findStoreLayerId(id) {
    const layers = getWmtsLayers()
    const match = layers.find((layer) => layer.storeId === id || layer.id === id)
    if (match) return match.storeId
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('Identifiant de couche WMTS invalide')
    if (id.includes('$') && !id.endsWith(WMTS_SUFFIX)) {
      throw new Error(`Le service de couche n'est pas pris en charge en 3D : ${id}`)
    }
    return id.endsWith(WMTS_SUFFIX) ? id : `${id}${WMTS_SUFFIX}`
  }

  const view = {
    get coordinates() {
      return { longitude: Number(mapStore.lon), latitude: Number(mapStore.lat) }
    },
    get zoom() {
      return Number(mapStore.zoom)
    },
    setView({ longitude, latitude }, zoom) {
      if (![longitude, latitude, zoom].every(Number.isFinite)) {
        throw new TypeError('Le point de vue doit contenir des coordonnées et un zoom finis')
      }
      const [x, y] = mercatorCoordinates(longitude, latitude)
      mapStore.lon = longitude
      mapStore.lat = latitude
      mapStore.x = x
      mapStore.y = y
      mapStore.zoom = zoom

      const map = mapStore.getMap?.()
      const mapView = map?.getView?.()
      mapView?.setCenter?.([x, y])
      mapView?.setZoom?.(zoom)
    },
  }

  const layers = {
    get layers2D() {
      return mapStore.getLayers()
    },
    get layers3D() {
      const ids = getWmtsLayers().map(({ id }) => id)
      if (elevationLayerId) ids.push(elevationLayerId)
      return ids
    },
    get descriptors3D() {
      const descriptors = getWmtsLayers().map(({ id, layer, type, visible, opacity, order }) => ({
        id,
        type,
        visible,
        opacity,
        order,
        source: { layer },
      }))
      if (elevationLayerId) {
        descriptors.push({
          id: elevationLayerId,
          type: 'elevation',
          visible: true,
          opacity: 1,
          order: 0,
          source: { layer: elevationLayerId },
        })
      }
      return descriptors
    },
    addLayer(layer) {
      const descriptor = typeof layer === 'string' ? { id: layer } : layer
      const id = findStoreLayerId(descriptor.id)
      if (!mapStore.getLayers().includes(id)) mapStore.addLayer(id)
      mapStore.updateLayerProperty(id, {
        position: Number.isFinite(descriptor.order) ? descriptor.order + 1 : mapStore.getLayers().length,
        opacity: descriptor.opacity ?? 1,
        visible: descriptor.visible ?? true,
      })
    },
    removeLayer(id) {
      const storeId = getWmtsLayers().find((layer) => layer.storeId === id || layer.id === id)?.storeId
      if (storeId) mapStore.removeLayer(storeId)
    },
    updateLayer(id, changes) {
      const storeId = getWmtsLayers().find((layer) => layer.storeId === id || layer.id === id)?.storeId
      if (!storeId) throw new Error(`Couche WMTS inconnue dans mapStore : ${id}`)
      const properties = {}
      if (changes.order !== undefined) properties.position = changes.order + 1
      if (changes.opacity !== undefined) properties.opacity = changes.opacity
      if (changes.visible !== undefined) properties.visible = changes.visible
      if (Object.keys(properties).length) mapStore.updateLayerProperty(storeId, properties)
    },
  }

  const controls = {
    get controls3D() {
      return [...new Set(mapStore.getControls()
        .map((id) => id && Object.hasOwn(controlMap, id) ? controlMap[id] : null)
        .filter(Boolean))]
    },
  }

  return {
    ...mapOptions,
    view,
    layers,
    controls,
    elevationLayerId,
  }
}
