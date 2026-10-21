import { watch } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat, toLonLat } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import ScaleLine from 'ol/control/ScaleLine'
import { CRS, LayerWMTS, LayerSwitcher, MousePosition } from 'geopf-extensions-openlayers'

const defaultControlTypes = {
  // LayerSwitcher,
  Scale: ScaleLine,
  // MousePosition
}

export function createMap2D({ layers, controls, view, controlTypes = {}, mapOptions = {} }) {
  const registry = { ...defaultControlTypes, ...controlTypes }
  let map = null
  let stopWatchingLayers = null
  let stopWatchingControls = null
  let stopWatchingView = null
  let eventKeys = []
  let addedControls = []

  async function load(target) {
    dispose()
    try {
      CRS.load()
      map = new Map({
        ...mapOptions,
        target,
        layers: [],
        view: new View({
          center: fromLonLat([view.coordinates.longitude, view.coordinates.latitude]),
          zoom: view.zoom,
        }),
      })
      const currentMap = map
      const mapView = currentMap.getView()
      stopWatchingView = watch(
        () => [view.coordinates.longitude, view.coordinates.latitude, view.zoom],
        ([longitude, latitude, zoom]) => {
          const center = fromLonLat([longitude, latitude])
          const current = mapView.getCenter()
          if (Math.abs(current[0] - center[0]) > 0.01 || Math.abs(current[1] - center[1]) > 0.01) {
            mapView.setCenter(center)
          }
          if (Math.abs(mapView.getZoom() - zoom) > 1e-6) {
            mapView.setZoom(zoom)
          }
        },
      )
      eventKeys.push(currentMap.on('moveend', () => {
        const [longitude, latitude] = toLonLat(mapView.getCenter())
        view.setView({ longitude, latitude }, mapView.getZoom())
      }))

      const loadedLayers = new globalThis.Map()
      const collection = currentMap.getLayers()
      eventKeys.push(
        collection.on('add', ({ element }) => {
          if (element instanceof LayerWMTS && element.name) {
            loadedLayers.set(element.name, element)
            layers.addLayer(element.name)
          }
        }),
        collection.on('remove', ({ element }) => {
          if (loadedLayers.get(element.name) === element) {
            loadedLayers.delete(element.name)
            layers.removeLayer(element.name)
          }
        }),
      )
      stopWatchingLayers = watch(
        () => layers.layers2D,
        (ids) => {
          for (const [id, layer] of loadedLayers) {
            if (!ids.includes(id)) {
              loadedLayers.delete(id)
              currentMap.removeLayer(layer)
            }
          }
          for (const id of ids) {
            if (!loadedLayers.has(id)) {
              try {
                const layer = new LayerWMTS({ layer: id })
                currentMap.addLayer(layer)
                loadedLayers.set(id, layer)
              } catch (cause) {
                console.error(`Impossible d'ajouter la couche 2D ${id} :`, cause)
              }
            }
          }
        },
        { immediate: true },
      )
      const loadedControlIds = new Set()
      stopWatchingControls = watch(
        () => controls.controls2D,
        (ids) => {
          for (const id of ids) {
            if (loadedControlIds.has(id)) continue
            try {
              const Control = Object.hasOwn(registry, id) ? registry[id] : null
              if (!Control) throw new Error(`Controle 2D inconnu : ${id}`)
              const control = new Control({})
              currentMap.addControl(control)
              addedControls.push(control)
              loadedControlIds.add(id)
            } catch (cause) {
              console.error(`Impossible d'ajouter le controle 2D ${id} :`, cause)
            }
          }
        },
        { immediate: true },
      )
      return currentMap
    } catch (cause) {
      dispose()
      throw cause
    }
  }

  function dispose() {
    stopWatchingLayers?.()
    stopWatchingControls?.()
    stopWatchingView?.()
    stopWatchingLayers = stopWatchingControls = stopWatchingView = null
    unByKey(eventKeys)
    eventKeys = []
    if (map) {
      for (const control of addedControls) map.removeControl(control)
      map.setTarget(null)
      map = null
    }
    addedControls = []
  }

  return { load, dispose }
}
