import { watch } from 'vue'
import { Coordinates } from 'itowns'
import { ELEVATION_LAYER_ID } from './state.js'
import {
  GlobeViewExtended,
  GeopfElevation,
  GeopfWMTS,
  LayerSwitcher,
  Scale,
  MousePosition,
} from 'geopf-extensions-itowns'

const defaultControlTypes = {
  // LayerSwitcher,
  Scale,
  // MousePosition
}

export function createMap3D({
  layers,
  controls,
  view,
  elevationLayerId = ELEVATION_LAYER_ID,
  controlTypes = {},
  globeOptions = {},
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
      for (const widget of [...globe.getWidgets()]) globe.removeWidget(widget)
      clearTimeout(globe._preRenderTimer)
      const globeView = globe.getGlobeView()
      globeView.dispose()
      globeView.mainLoop.gfxEngine.renderer.dispose()
      globe.getTargetElement().replaceChildren()
    }

    disposeCurrent = disposeSession
    try {
      globe = new GlobeViewExtended(target, {
        tilt: 45,
        heading: 0,
        ...globeOptions,
        coord: new Coordinates('EPSG:4326', view.coordinates.longitude, view.coordinates.latitude, 0),
        zoom: view.zoom,
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
              Math.abs(globe.getZoom() - view.zoom) <= 1e-6) {
              continue
            }
            await globeView.controls.lookAtCoordinate({
              coord: new Coordinates('EPSG:4326', longitude, latitude, 0),
              range: globeView.tileLayer.computeDistanceCameraFromTileZoom(view.zoom, globeView.camera),
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
        if (!applyingView && active) view.setView(getCoordinates(), globe.getZoom())
      }
      eventKeys.push(...[
        GlobeViewExtended.EVENTS.CENTER_CHANGED,
        GlobeViewExtended.EVENTS.RANGE_CHANGED,
      ].map((event) => globe.listen(event, updateView)))

      const loadedLayers = new Map()
      eventKeys.push(
        globe.listen(GlobeViewExtended.EVENTS.LAYER_ADDED, ({ layerId }) => {
          const layer = globeView.getLayerById(layerId)
          if (!layer?.isColorLayer || !layer.source?.isWMTSSource) return
          const parameters = new URL(layer.source.url).searchParams
          const id = parameters.get('LAYER') ?? parameters.get('layer')
          if (id && loadedLayers.get(id) !== layer) {
            loadedLayers.set(id, layer)
            layers.addLayer(id)
          }
        }),
        globe.listen(GlobeViewExtended.EVENTS.LAYER_REMOVED, ({ layerId }) => {
          for (const [id, layer] of loadedLayers) {
            if (layer.id === layerId) {
              loadedLayers.delete(id)
              if (id !== elevationLayerId) layers.removeLayer(id)
              break
            }
          }
        }),
      )
      async function syncLayers() {
        if (!active) return
        for (const [id, layer] of loadedLayers) {
          if (!layers.layers3D.includes(id)) {
            loadedLayers.delete(id)
            globe.removeLayer(layer.id)
          }
        }
        for (const id of layers.layers3D) {
          if (!active) return
          if (loadedLayers.has(id) || !layers.layers3D.includes(id)) continue
          const Layer = id === elevationLayerId ? GeopfElevation : GeopfWMTS
          const layer = new Layer({ layer: id, itownsParams: { source: { attribution } } })
          layer.source.url = layer.source.url.replace(/^http:/, 'https:')
          loadedLayers.set(id, layer)
          try {
            await globe.addLayer(layer)
          } catch (cause) {
            loadedLayers.delete(id)
            throw cause
          }
          if (!active) return
          if (!layers.layers3D.includes(id) && loadedLayers.get(id) === layer) {
            loadedLayers.delete(id)
            globe.removeLayer(layer.id)
          }
        }
      }
      let additions = syncLayers()
      stopWatchingLayers = watch(
        () => layers.layers3D,
        () => {
          additions = additions.then(syncLayers).catch((cause) => {
            if (active) console.error('Impossible de synchroniser les couches 3D :', cause)
          })
        },
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
