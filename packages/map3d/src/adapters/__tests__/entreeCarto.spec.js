import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createEntreeCartoAdapter } from '../entreeCarto.js'

function createMapStore() {
  const entries = reactive([
    {
      id: 'ORTHOIMAGERY.ORTHOPHOTOS$GEOPORTAIL:OGC:WMTS',
      position: 2,
      opacity: 0.6,
      visible: false,
    },
    {
      id: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS$GEOPORTAIL:OGC:WMS',
      position: 1,
      opacity: 1,
      visible: true,
    },
  ])
  const controls = reactive(['LayerSwitcher', 'ScaleLine', 'Drawing'])
  const mapView = { setCenter: vi.fn(), setZoom: vi.fn() }
  const mapStore = reactive({
    lon: 2,
    lat: 48,
    zoom: 10,
    x: 0,
    y: 0,
    getLayers: () => entries.map(({ id }) => id),
    getLayerProperty: (id) => entries.find((layer) => layer.id === id),
    addLayer: (id) => entries.push({ id, position: -1, opacity: 1, visible: true }),
    removeLayer: (id) => {
      const index = entries.findIndex((layer) => layer.id === id)
      if (index >= 0) entries.splice(index, 1)
    },
    updateLayerProperty: (id, changes) => Object.assign(entries.find((layer) => layer.id === id), changes),
    getControls: () => controls,
    getMap: () => ({ getView: () => mapView }),
  })

  return { entries, controls, mapStore, mapView }
}

describe('createEntreeCartoAdapter', () => {
  it('adapts the mapStore view, WMTS layers, elevation and supported controls reactively', () => {
    const { entries, controls, mapStore } = createMapStore()
    const options = createEntreeCartoAdapter({ mapStore })

    expect(options.view.coordinates).toEqual({ longitude: 2, latitude: 48 })
    expect(options.view.zoom).toBe(10)
    expect(options.layers.layers3D).toEqual(['ORTHOIMAGERY.ORTHOPHOTOS', 'ELEVATION.ELEVATIONGRIDCOVERAGE'])
    expect(options.layers.descriptors3D).toEqual([
      {
        id: 'ORTHOIMAGERY.ORTHOPHOTOS',
        type: 'WMTS',
        visible: false,
        opacity: 0.6,
        order: 1,
        source: { layer: 'ORTHOIMAGERY.ORTHOPHOTOS' },
      },
      {
        id: 'ELEVATION.ELEVATIONGRIDCOVERAGE',
        type: 'elevation',
        visible: true,
        opacity: 1,
        order: 0,
        source: { layer: 'ELEVATION.ELEVATIONGRIDCOVERAGE' },
      },
    ])
    expect(options.controls.controls3D).toEqual(['LayerSwitcher', 'Scale'])

    entries[0].opacity = 0.3
    controls.push('MousePosition')
    mapStore.lon = 4
    expect(options.layers.descriptors3D[0].opacity).toBe(0.3)
    expect(options.controls.controls3D).toEqual(['LayerSwitcher', 'Scale', 'MousePosition'])
    expect(options.view.coordinates.longitude).toBe(4)
  })

  it('writes globe view and layer changes back through the mapStore actions', () => {
    const { entries, mapStore, mapView } = createMapStore()
    const options = createEntreeCartoAdapter({ mapStore, elevationLayerId: null })

    options.view.setView({ longitude: 3, latitude: 45 }, 12)
    expect(mapStore.lon).toBe(3)
    expect(mapStore.lat).toBe(45)
    expect(mapStore.zoom).toBe(12)
    expect(mapStore.x).toBeCloseTo(333958.47, 1)
    expect(mapStore.y).toBeCloseTo(5621521.49, 1)
    expect(mapView.setCenter).toHaveBeenCalledWith([mapStore.x, mapStore.y])
    expect(mapView.setZoom).toHaveBeenCalledWith(12)

    options.layers.updateLayer('ORTHOIMAGERY.ORTHOPHOTOS', {
      visible: true,
      opacity: 0.4,
      order: 0,
    })
    expect(entries[0]).toMatchObject({ visible: true, opacity: 0.4, position: 1 })

    options.layers.addLayer({
      id: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
      visible: false,
      opacity: 0.5,
      order: 1,
    })
    expect(entries[2]).toMatchObject({
      id: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2$GEOPORTAIL:OGC:WMTS',
      visible: false,
      opacity: 0.5,
      position: 2,
    })
    options.layers.removeLayer('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')
    expect(entries).toHaveLength(2)
  })

  it('allows disabling elevation and mapping additional controls', () => {
    const { mapStore } = createMapStore()
    const options = createEntreeCartoAdapter({
      mapStore,
      elevationLayerId: null,
      controlMappings: { Drawing: 'CustomDrawing', LayerSwitcher: null },
      controlTypes: { CustomDrawing: class CustomDrawing { } },
    })

    expect(options.elevationLayerId).toBeNull()
    expect(options.layers.layers3D).toEqual(['ORTHOIMAGERY.ORTHOPHOTOS'])
    expect(options.controls.controls3D).toEqual(['Scale', 'CustomDrawing'])
    expect(options.controlTypes.CustomDrawing).toBeDefined()
  })

  it('rejects a store that does not implement the required API', () => {
    expect(() => createEntreeCartoAdapter({ mapStore: {} })).toThrow(/getLayers/)
  })
})
