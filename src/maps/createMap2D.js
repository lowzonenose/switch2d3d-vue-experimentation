import { watch } from 'vue'
import 'ol/ol.css'
import 'geopf-extensions-openlayers/css/Classic.css'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat, toLonLat } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import ScaleLine from 'ol/control/ScaleLine'
import { CRS, LayerWMTS, LayerSwitcher, MousePosition } from 'geopf-extensions-openlayers'
import { getLayerDescriptors } from './state.js'

const defaultControlTypes = {
  LayerSwitcher,
  Scale: ScaleLine,
  MousePosition
}

export function createMap2D({ layers, controls, view, controlTypes = {}, mapOptions = {}, isActive = () => true }) {
  const registry = { ...defaultControlTypes, ...controlTypes }
  let map = null
  let stopWatchingLayers = null
  let stopWatchingControls = null
  let stopWatchingView = null
  let eventKeys = []
  let addedControls = []
  const layerKeys = new globalThis.Map()

  async function load(target) {
    dispose()
    try {
      CRS.load()
      target.classList.add('map2d')
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
          console.warn('Updating view from 2D map', toLonLat(mapView.getCenter()), mapView.getZoom(), zoom)
        },
      )
      eventKeys.push(currentMap.on('moveend', () => {
        if (!isActive()) return
        const [longitude, latitude] = toLonLat(mapView.getCenter())
        view.setView({ longitude, latitude }, mapView.getZoom())
      }))

      const loadedLayers = new globalThis.Map()
      const definitions = new globalThis.Map()
      const collection = currentMap.getLayers()
      let applyingLayers = false

      function observeLayer(id, layer) {
        loadedLayers.set(id, layer)
        let publishPending = false
        const changes = new Set()
        layerKeys.set(id, layer.on(['change:visible', 'change:opacity', 'change:zIndex'], (event) => {
          if (applyingLayers || !layers.updateLayer) return
          changes.add(event.type)
          if (publishPending) return
          publishPending = true
          queueMicrotask(() => {
            publishPending = false
            if (map !== currentMap || loadedLayers.get(id) !== layer || !layers.layers2D.includes(id)) return
            const patch = {}
            if (changes.has('change:visible')) patch.visible = layer.getVisible()
            if (changes.has('change:opacity')) patch.opacity = layer.getOpacity()
            if (changes.has('change:zIndex')) patch.order = layer.getZIndex() ?? collection.getArray().indexOf(layer)
            changes.clear()
            layers.updateLayer(id, patch)
          })
        }))
      }

      function forgetLayer(id) {
        unByKey(layerKeys.get(id) ?? [])
        layerKeys.delete(id)
        loadedLayers.delete(id)
        definitions.delete(id)
      }

      eventKeys.push(
        collection.on('add', ({ element }) => {
          if (!applyingLayers && element instanceof LayerWMTS && element.name) {
            observeLayer(element.name, element)
            const descriptor = {
              id: element.name, visible: element.getVisible(), opacity: element.getOpacity(),
              order: element.getZIndex() ?? collection.getLength() - 1,
              source: { layer: element.name },
            }
            layers.addLayer(layers.updateLayer ? descriptor : element.name)
          }
        }),
        collection.on('remove', ({ element }) => {
          const entry = [...loadedLayers].find(([, layer]) => layer === element)
          if (!applyingLayers && entry) {
            forgetLayer(entry[0])
            layers.removeLayer(entry[0])
          }
        }),
      )
      stopWatchingLayers = watch(
        () => getLayerDescriptors(layers, '2D'),
        (descriptors) => {
          applyingLayers = true
          try {
            for (const [id, layer] of loadedLayers) {
              const descriptor = descriptors.find((item) => item.id === id)
              if (!descriptor || (definitions.has(id) &&
                definitions.get(id) !== JSON.stringify([descriptor.type, descriptor.source]))) {
                forgetLayer(id)
                currentMap.removeLayer(layer)
              }
            }
            for (const [order, descriptor] of descriptors.entries()) {
              const { id, type, source, visible, opacity } = descriptor
              try {
                if (type !== 'WMTS') throw new Error(`Type de couche 2D non pris en charge : ${type}`)
                let layer = loadedLayers.get(id)
                if (!layer) {
                  layer = new LayerWMTS({ layer: source.layer })
                  observeLayer(id, layer)
                  currentMap.addLayer(layer)
                }
                definitions.set(id, JSON.stringify([type, source]))
                if (layer.getVisible() !== visible) layer.setVisible(visible)
                if (layer.getOpacity() !== opacity) layer.setOpacity(opacity)
                // LayerSwitcher treats a zero z-index as an unspecified position.
                if (layer.getZIndex() !== order + 1) layer.setZIndex(order + 1)
              } catch (cause) {
                console.error(`Impossible d'ajouter la couche 2D ${id} :`, cause)
              }
            }
          } finally {
            applyingLayers = false
          }
        },
        { immediate: true, deep: true },
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
    for (const keys of layerKeys.values()) unByKey(keys)
    layerKeys.clear()
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
