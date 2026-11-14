import '../global.js'
import { watch } from 'vue'
import 'geopf-extensions-itowns/css/Classic.css'
import { Coordinates } from 'itowns'
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

const defaultControlTypes = {
  LayerSwitcher,
  Scale,
  MousePosition
}

/**
 * Obtient les descripteurs de couches 3D à partir de l'objet layers.
 *
 * @param {Object<string, any>} layers - Un objet contenant soit des descripteurs de couches 3D, soit un tableau d'identifiants de couches 3D.
 * @returns {Array} Une liste de descripteurs de couches 3D.
 * @throws {Error} Si un identifiant de couche est invalide.
 * @example
 * const layers = {
 *   layers3D: ['layer1', 'layer2']
 * }
 * const descriptors = getLayerDescriptors(layers)
 */
function getLayerDescriptors(layers) {
  return layers.descriptors3D ?? layers.layers3D.map((id, order) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Identifiant de couche invalide')
    return {
      id,
      type: 'WMTS',
      visible: true,
      opacity: 1,
      order,
      source: { layer: id }
    }
  })
}

/**
 * Crée une carte 3D avec les options spécifiées.
 * Les options layers, controls et view sont réactives
 * et peuvent être mises à jour dynamiquement.
 *
 * @param {Object} options - Les options pour créer la carte 3D.
 * @param {Object<string, any>} options.layers - Les couches à afficher sur la carte 3D.
 * @param {Object<string, any>} options.controls - Les contrôles à ajouter à la carte 3D.
 * @param {Object} options.view - La vue initiale de la carte 3D.
 * @param {string} options.elevationLayerId - L'identifiant de la couche d'élévation.
 * @param {Object} [options.controlTypes] - Les types de contrôles disponibles.
 * @param {Object} [options.globeOptions] - Les options pour le globe 3D.
 * @param {Function} [options.isActive] - Une fonction qui détermine si la carte est active.
 * @param {Array} [options.attribution] - Les informations d'attribution pour la carte.
 * @returns {Object} Un objet contenant la fonction load pour initialiser la carte 3D et la fonction dispose pour la nettoyer.
 * @example
 * const map3D = createMap3D({
 *   layers: { layers3D: ['layer1', 'layer2'] },
 *   controls: {},
 *   view: { center: new Coordinates('EPSG:4326', 0, 0), zoom: 2 },
 *   elevationLayerId: 'elevationLayer'
 * })
 * map3D.load(document.getElementById('map3d'))
 * // Pour nettoyer la carte 3D
 * map3D.dispose()
 */
export function createMap3D({
  layers,
  controls,
  view,
  elevationLayerId,
  controlTypes = {},
  globeOptions = {},
  isActive = () => true,
  attribution = [{ name: 'IGN', url: 'https://www.ign.fr/' }],
}) {
  const registry = { ...defaultControlTypes, ...controlTypes }
  let disposeCurrent = () => { }

  /**
   * Charge la carte 3D dans l'élément cible.
   * @param {HTMLElement} target
   * @throws {Error} Si l'identifiant de couche est invalide.
   * @returns {Promise<void>} Une promesse qui se résout lorsque la carte 3D est chargée.
   */
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

    /**
     * Réinitialise et nettoie la session de la carte 3D.
     * @throws {Error} Si la session de la carte 3D ne peut pas être réinitialisée.
     * @returns {void} Ne retourne rien.
     */
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
      for (const widget of Array.from(globe.getWidgets())) globe.removeWidget(widget)
      clearTimeout(globe._preRenderTimer)
      const globeView = globe.getGlobeView()
      globeView.dispose()
      globeView.mainLoop.gfxEngine.renderer.dispose()
      globe.getTargetElement().replaceChildren()
    }

    // Dispose de la session actuelle si elle existe avant de créer une nouvelle instance.
    disposeCurrent = disposeSession

    try {
      // Ajout de la classe CSS pour le conteneur de la carte 3D.
      target.classList.add('map3d')
      // Création de l'instance GlobeViewExtended avec les options spécifiées.
      globe = new GlobeViewExtended(target, {
        tilt: 45,
        heading: 0,
        ...globeOptions,
        coord: new Coordinates('EPSG:4326', view.coordinates.longitude, view.coordinates.latitude, 0),
        zoom: view.zoom + ZOOM_OFFSET_3D,
      })

      // Initialisation de la vue 3D et configuration de l'observateur de redimensionnement.
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

      // Fonction utilitaire pour obtenir les coordonnées actuelles du centre de la vue 3D.
      const getCoordinates = () => {
        const { lon, lat } = globe.getCenter()
        return { longitude: lon, latitude: lat }
      }
      // Indique si une mise à jour de la vue est en cours d'application.
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
      // Surveillance des changements de la vue 2D pour les appliquer à la vue 3D.
      stopWatchingView = watch(
        [
          () => view.coordinates.longitude,
          () => view.coordinates.latitude,
          () => view.zoom
        ],
        applyView,
        { immediate: true },
      )
      // Fonction utilitaire pour mettre à jour la vue 2D en fonction de la vue 3D.
      const updateView = () => {
        if (!applyingView && active && isActive()) {
          view.setView(getCoordinates(), globe.getZoom() - ZOOM_OFFSET_3D)
        }
      }
      // Surveillance des changements de la vue 3D pour les appliquer à la vue 2D.
      eventKeys.push(...[
        GlobeViewExtended.EVENTS.CENTER_CHANGED,
        GlobeViewExtended.EVENTS.RANGE_CHANGED,
      ].map((event) => globe.listen(event, updateView)))

      const loadedLayers = new Map()
      const definitions = new Map()
      let applyingLayers = false

      // Fonction pour observer les changements d'une couche 3D
      // et les synchroniser avec la vue 3D.
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
            if (!active || loadedLayers.get(id) !== layer || !layers.layers3D.includes(id)) return
            const patch = {}
            for (const property of changes) patch[property === 'sequence' ? 'order' : property] = layer[property]
            changes.clear()
            layers.updateLayer(id, patch)
          })
        }
        layerKeys.set(id, ['visible', 'opacity', 'sequence'].map((property) =>
          globe.addLayerListener(layer, `${property}-property-changed`, () => publish(property))))
      }

      // Fonction pour oublier une couche 3D et nettoyer ses observateurs.
      function forgetLayer(id) {
        for (const key of layerKeys.get(id) ?? []) globe.forgetByKey(key)
        layerKeys.delete(id)
        loadedLayers.delete(id)
        definitions.delete(id)
      }

      // Synchronisation initiale des couches 3D avec l'état actuel de la vue 3D.
      eventKeys.push(
        // Écoute des ajouts et suppressions de couches dans la vue 3D.
        globe.listen(GlobeViewExtended.EVENTS.LAYER_ADDED, ({ layerId }) => {
          const layer = globeView.getLayerById(layerId)
          if (!layer?.isColorLayer || !layer.source?.isWMTSSource) return
          const parameters = new URL(layer.source.url).searchParams
          const id = parameters.get('LAYER') ?? parameters.get('layer')
          if (id && ![...loadedLayers.values()].includes(layer)) {
            observeLayer(id, layer)
            const descriptor = {
              id, visible: layer.visible, opacity: layer.opacity,
              order: layer.sequence, source: { layer: id },
            }
            layers.addLayer(layers.updateLayer ? descriptor : id)
          }
        }),
        // Écoute des modifications de propriétés des couches dans la vue 3D.
        globe.listen(GlobeViewExtended.EVENTS.LAYER_REMOVED, ({ layerId }) => {
          for (const [id, layer] of loadedLayers) {
            if (layer.id === layerId) {
              forgetLayer(id)
              if (layer.isColorLayer && id !== elevationLayerId) layers.removeLayer(id)
              break
            }
          }
        }),
      )
      // Fonction de synchronisation des couches 3D avec l'état actuel
      // des couches dans la vue 3D.
      async function syncLayers() {
        if (!active) return
        const descriptors = getLayerDescriptors(layers)
        for (const [id, layer] of loadedLayers) {
          const descriptor = descriptors.find((item) => item.id === id)
          if (!layers.layers3D.includes(id) || !descriptor || (definitions.has(id) &&
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
          const isElevation = type === 'elevation' || (elevationLayerId != null && id === elevationLayerId)
          if (!isElevation && type !== 'WMTS') {
            throw new Error(`Type de couche 3D non pris en charge : ${type}`)
          }
          const Layer = isElevation ? GeopfElevation : GeopfWMTS
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
          for (const descriptor of getLayerDescriptors(layers)) {
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

      // Surveillance des changements des couches 3D pour les synchroniser avec la vue 3D.
      let additions = Promise.resolve()
      stopWatchingLayers = watch(
        () => [
          layers.layers3D,
          getLayerDescriptors(layers)
        ],
        () => {
          additions = additions.then(syncLayers).catch((cause) => {
            if (active) console.error('Impossible de synchroniser les couches 3D :', cause)
          })
        },
        { deep: true },
      )
      additions = additions.then(syncLayers)
      await additions
      if (!active) return

      // Surveillance des changements des contrôles 3D pour les synchroniser avec la vue 3D.
      const loadedControls = new Map()
      stopWatchingControls = watch(
        () => controls.controls3D,
        (ids) => {
          // Suppression des contrôles 3D qui ne sont plus présents
          // dans la liste des identifiants.
          for (const [id, widget] of loadedControls) {
            if (!ids.includes(id)) {
              globe.removeWidget(widget)
              loadedControls.delete(id)
            }
          }
          // Ajout des nouveaux contrôles 3D présents
          // dans la liste des identifiants.
          for (const id of ids) {
            if (loadedControls.has(id)) continue
            try {
              const Control = Object.hasOwn(registry, id) ? registry[id] : null
              if (!Control) throw new Error(`Controle 3D inconnu : ${id}`)
              const widget = new Control({})
              globe.addWidget(widget)
              loadedControls.set(id, widget)
            } catch (cause) {
              console.error(`Impossible d'ajouter le controle 3D ${id} :`, cause)
            }
          }
        },
        { immediate: true, deep: true },
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
