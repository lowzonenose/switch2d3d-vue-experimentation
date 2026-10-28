import { watch } from 'vue'
import 'geopf-extensions-itowns/css/Classic.css'
import { Coordinates } from 'itowns'
import { ELEVATION_LAYER_ID, getLayerDescriptors } from './state.js'
import {
  GlobeViewExtended,
  GeopfElevation,
  GeopfWMTS,
  LayerSwitcher,
  Scale,
  MousePosition,
} from 'geopf-extensions-itowns'

// Racine iTowns = 180 deg (niveau z couvre 180/2^z), TileMatrixSet PM = 360 deg :
// niveau 3D = niveau 2D - 1 pour des tuiles de meme taille.
const ZOOM_OFFSET_3D = -1

// Meme URL que celle d'OpenLayers (ordre et casse des parametres) afin de
// partager le cache HTTP du navigateur entre les vues 2D et 3D.
function toSharedTileUrl(url) {
  const { origin, pathname, searchParams } = new URL(url)
  const params = new Map([...searchParams].map(([key, value]) => [key.toLowerCase(), value]))
  const get = (key) => encodeURIComponent(params.get(key) ?? '')
  return `${origin}${pathname}?layer=${get('layer')}&style=${get('style')}` +
    `&tilematrixset=${get('tilematrixset')}&Service=WMTS&Request=GetTile` +
    `&Version=${get('version')}&Format=${get('format')}` +
    '&TileMatrix=%TILEMATRIX&TileCol=%COL&TileRow=%ROW'
}

const defaultControlTypes = {
  LayerSwitcher,
  Scale,
  MousePosition
}

export function createMap3D({
  layers,
  controls,
  view,
  elevationLayerId = ELEVATION_LAYER_ID,
  controlTypes = {},
  globeOptions = {},
  isActive = () => true,
  attribution = [{ name: 'IGN', url: 'https://www.ign.fr/' }],
}) {
  const registry = { ...defaultControlTypes, ...controlTypes }
  let disposeCurrent = () => { }

  async function load(target) {
    dispose()
    let globe = null
    let active = true
    let resizeObserver = null
    let stopWatchingLayers = null
    let stopWatchingControls = null
    let stopWatchingView = null
    let initializationKey = null
    let finishInitialization = null
    const eventKeys = []
    const layerKeys = new Map()

    function disposeSession() {
      if (!active) return
      active = false
      stopWatchingLayers?.()
      stopWatchingControls?.()
      stopWatchingView?.()
      resizeObserver?.disconnect()
      if (initializationKey) globe.forgetByKey(initializationKey)
      initializationKey = null
      finishInitialization?.()
      if (!globe) return
      for (const key of eventKeys) globe.forgetByKey(key)
      for (const keys of layerKeys.values()) {
        for (const key of keys) globe.forgetByKey(key)
      }
      layerKeys.clear()
      for (const widget of [...globe.getWidgets()]) globe.removeWidget(widget)
      clearTimeout(globe._preRenderTimer)
      const globeView = globe.getGlobeView()
      globeView.dispose()
      globeView.mainLoop.gfxEngine.renderer.dispose()
      globe.getTargetElement().replaceChildren()
    }

    disposeCurrent = disposeSession
    try {
      target.classList.add('map3d')
      globe = new GlobeViewExtended(target, {
        tilt: 45,
        heading: 0,
        ...globeOptions,
        coord: new Coordinates('EPSG:4326', view.coordinates.longitude, view.coordinates.latitude, 0),
        zoom: view.zoom + ZOOM_OFFSET_3D,
      })
      const globeView = globe.getGlobeView()
      resizeObserver = new ResizeObserver(() => {
        if (active) globeView.resize()
      })
      resizeObserver.observe(target)
      await new Promise((resolve) => {
        finishInitialization = resolve
        initializationKey = globe.listen(GlobeViewExtended.EVENTS.GLOBE_INITIALIZED, resolve)
      })
      if (!active) return
      globe.forgetByKey(initializationKey)
      initializationKey = null
      finishInitialization = null

      const getCoordinates = () => {
        const { lon, lat } = globe.getCenter()
        return { longitude: lon, latitude: lat }
      }
      let applyingView = false
      let updateRequested = false
      async function applyView() {
        updateRequested = true
        if (applyingView) return
        applyingView = true
        try {
          while (updateRequested && active) {
            updateRequested = false
            const { longitude, latitude } = view.coordinates
            const center = getCoordinates()
            if (Math.abs(center.longitude - longitude) <= 1e-7 &&
              Math.abs(center.latitude - latitude) <= 1e-7 &&
              Math.abs(globe.getZoom() - (view.zoom + ZOOM_OFFSET_3D)) <= 0.5) {
              continue
            }
            await globeView.controls.lookAtCoordinate({
              coord: new Coordinates('EPSG:4326', longitude, latitude, 0),
              range: globeView.tileLayer.computeDistanceCameraFromTileZoom(view.zoom + ZOOM_OFFSET_3D, globeView.camera),
            }, false)
          }
        } catch (cause) {
          if (active) console.error('Impossible de synchroniser la vue 3D :', cause)
        } finally {
          applyingView = false
        }
      }
      stopWatchingView = watch(
        () => [view.coordinates.longitude, view.coordinates.latitude, view.zoom],
        applyView,
        { immediate: true },
      )
      const updateView = () => {
        console.warn('Updating view from 3D map', getCoordinates(), globe.getZoom(), view.zoom)
        if (!applyingView && active && isActive()) {
          view.setView(getCoordinates(), globe.getZoom() - ZOOM_OFFSET_3D)
        }
      }
      eventKeys.push(...[
        GlobeViewExtended.EVENTS.CENTER_CHANGED,
        GlobeViewExtended.EVENTS.RANGE_CHANGED,
      ].map((event) => globe.listen(event, updateView)))

      const loadedLayers = new Map()
      const definitions = new Map()
      let applyingLayers = false

      function observeLayer(id, layer) {
        loadedLayers.set(id, layer)
        if (!layer.isColorLayer) return
        let publishPending = false
        const changes = new Set()
        const publish = (property) => {
          if (applyingLayers || !layers.updateLayer) return
          changes.add(property)
          if (publishPending) return
          publishPending = true
          queueMicrotask(() => {
            publishPending = false
            if (!active || loadedLayers.get(id) !== layer || !layers.layers2D.includes(id)) return
            const patch = {}
            for (const property of changes) patch[property === 'sequence' ? 'order' : property] = layer[property]
            changes.clear()
            layers.updateLayer(id, patch)
          })
        }
        layerKeys.set(id, ['visible', 'opacity', 'sequence'].map((property) =>
          globe.addLayerListener(layer, `${property}-property-changed`, () => publish(property))))
      }

      function forgetLayer(id) {
        for (const key of layerKeys.get(id) ?? []) globe.forgetByKey(key)
        layerKeys.delete(id)
        loadedLayers.delete(id)
        definitions.delete(id)
      }

      eventKeys.push(
        globe.listen(GlobeViewExtended.EVENTS.LAYER_ADDED, ({ layerId }) => {
          const layer = globeView.getLayerById(layerId)
          if (!layer?.isColorLayer || !layer.source?.isWMTSSource) return
          const parameters = new URL(layer.source.url).searchParams
          const id = parameters.get('LAYER') ?? parameters.get('layer')
          layer.source.url = toSharedTileUrl(layer.source.url)
          if (id && ![...loadedLayers.values()].includes(layer)) {
            observeLayer(id, layer)
            const descriptor = {
              id, visible: layer.visible, opacity: layer.opacity,
              order: layer.sequence, source: { layer: id },
            }
            layers.addLayer(layers.updateLayer ? descriptor : id)
          }
        }),
        globe.listen(GlobeViewExtended.EVENTS.LAYER_REMOVED, ({ layerId }) => {
          for (const [id, layer] of loadedLayers) {
            if (layer.id === layerId) {
              forgetLayer(id)
              if (id !== elevationLayerId) layers.removeLayer(id)
              break
            }
          }
        }),
      )
      async function syncLayers() {
        if (!active) return
        const descriptors = getLayerDescriptors(layers, '3D')
        for (const [id, layer] of loadedLayers) {
          const descriptor = descriptors.find((item) => item.id === id)
          if (!descriptor || (definitions.has(id) &&
            definitions.get(id) !== JSON.stringify([descriptor.type, descriptor.source]))) {
            forgetLayer(id)
            applyingLayers = true
            try {
              globe.removeLayer(layer.id)
            } finally {
              applyingLayers = false
            }
          }
        }
        for (const descriptor of descriptors) {
          const { id, type, source } = descriptor
          if (!active) return
          if (loadedLayers.has(id) || !layers.layers3D.includes(id)) continue
          if (id !== elevationLayerId && type !== 'WMTS') {
            throw new Error(`Type de couche 3D non pris en charge : ${type}`)
          }
          const Layer = id === elevationLayerId ? GeopfElevation : GeopfWMTS
          const layer = new Layer({ layer: source.layer, itownsParams: { source: { attribution } } })
          layer.source.url = layer.source.url.replace(/^http:/, 'https:')
          loadedLayers.set(id, layer)
          definitions.set(id, JSON.stringify([type, source]))
          try {
            await globe.addLayer(layer)
          } catch (cause) {
            forgetLayer(id)
            throw cause
          }
          if (!active) return
          observeLayer(id, layer)
          if (!layers.layers3D.includes(id) && loadedLayers.get(id) === layer) {
            forgetLayer(id)
            globe.removeLayer(layer.id)
          }
        }
        applyingLayers = true
        try {
          let order = 0
          for (const descriptor of getLayerDescriptors(layers, '3D')) {
            const layer = loadedLayers.get(descriptor.id)
            if (!layer) continue
            if (layer.visible !== descriptor.visible) globe.setLayerVisibility(layer.id, descriptor.visible)
            if (layer.isColorLayer) {
              if (layer.opacity !== descriptor.opacity) globe.setLayerOpacity(layer.id, descriptor.opacity)
              if (layer.sequence !== order) globe.moveLayerToIndex(layer.id, order)
              order++
            }
          }
        } finally {
          applyingLayers = false
        }
      }
      let additions = syncLayers()
      stopWatchingLayers = watch(
        () => getLayerDescriptors(layers, '3D'),
        () => {
          additions = additions.then(syncLayers).catch((cause) => {
            if (active) console.error('Impossible de synchroniser les couches 3D :', cause)
          })
        },
        { deep: true },
      )
      await additions
      if (!active) return

      const loadedControlIds = new Set()
      stopWatchingControls = watch(
        () => controls.controls3D,
        (ids) => {
          for (const id of ids) {
            if (loadedControlIds.has(id)) continue
            try {
              const Control = Object.hasOwn(registry, id) ? registry[id] : null
              if (!Control) throw new Error(`Controle 3D inconnu : ${id}`)
              globe.addWidget(new Control({}))
              loadedControlIds.add(id)
            } catch (cause) {
              console.error(`Impossible d'ajouter le controle 3D ${id} :`, cause)
            }
          }
        },
        { immediate: true },
      )
      return globe
    } catch (cause) {
      if (!active) return
      disposeSession()
      throw cause
    }
  }

  function dispose() {
    disposeCurrent()
    disposeCurrent = () => { }
  }

  return { load, dispose }
}
