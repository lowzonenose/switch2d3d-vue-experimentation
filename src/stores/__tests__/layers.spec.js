import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ELEVATION_LAYER_ID, useLayersStore } from '../layers'
import { createMapState } from '../../maps/state.js'

describe('layers store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('shares imagery layers and reserves elevation for 3D', () => {
        const store = useLayersStore()
        expect(store.layers2D).toEqual([
            'ORTHOIMAGERY.ORTHOPHOTOS',
            'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        ])
        expect(store.layers3D).toEqual([...store.layers2D, ELEVATION_LAYER_ID])
    })

    it('updates both views on addition without duplicates', () => {
        const store = useLayersStore()
        store.addLayer('TEST.WMTS')
        store.addLayer('TEST.WMTS')
        store.addLayer(ELEVATION_LAYER_ID)
        expect(store.layers2D.filter((id) => id === 'TEST.WMTS')).toHaveLength(1)
        expect(store.layers2D).not.toContain(ELEVATION_LAYER_ID)
        expect(store.layers3D).toEqual([...store.layers2D, ELEVATION_LAYER_ID])
    })

    it('removes shared layers from both views and allows adding them again', () => {
        const store = useLayersStore()
        const id = store.layers2D[0]
        store.removeLayer(id)
        store.removeLayer(id)
        expect(store.layers2D).not.toContain(id)
        expect(store.layers3D).not.toContain(id)
        store.removeLayer(ELEVATION_LAYER_ID)
        expect(store.layers3D).toContain(ELEVATION_LAYER_ID)
        store.addLayer(id)
        expect(store.layers2D.filter((layerId) => layerId === id)).toHaveLength(1)
        expect(store.layers3D).toContain(id)
    })

    it('stores engine-independent descriptors and retains the legacy identifiers API', () => {
        const store = useLayersStore()
        expect(store.layerDescriptors[0]).toEqual({
            id: 'ORTHOIMAGERY.ORTHOPHOTOS', type: 'WMTS', visible: true, opacity: 1, order: 0,
            source: { layer: 'ORTHOIMAGERY.ORTHOPHOTOS' },
        })
        store.addLayer({ id: 'TEST', visible: false, opacity: 0.4, source: { layer: 'TEST.WMTS' } })
        store.addLayer('TEST')
        expect(store.descriptors2D.find(({ id }) => id === 'TEST')).toEqual({
            id: 'TEST', type: 'WMTS', visible: false, opacity: 0.4, order: 2, source: { layer: 'TEST.WMTS' },
        })
        const order = [...store.layers2D].reverse()
        store.reorderLayers(order)
        expect(store.layers2D).toEqual(order)
        expect(store.descriptors2D.map(({ order }) => order)).toEqual([0, 1, 2])
        store.updateLayer('TEST', { visible: true, opacity: 0, order: 10 })
        expect(store.layers2D.at(-1)).toBe('TEST')
        store.layerIds = ['TEST', 'OTHER', 'TEST', ELEVATION_LAYER_ID]
        expect(store.layers2D).toEqual(['TEST', 'OTHER'])
        expect(store.descriptors2D[0]).toMatchObject({ visible: true, opacity: 0, source: { layer: 'TEST.WMTS' } })
    })

    it('copies input descriptors and source objects for independent map states', () => {
        const input = [{ id: 'TEST', visible: false, source: { layer: 'TEST.WMTS' } }]
        const first = createMapState({ layerDescriptors: input })
        const second = createMapState({ layerDescriptors: input, elevationLayerId: null })
        first.layers.layerDescriptors[0].source.layer = 'OTHER'
        first.layers.updateLayer('TEST', { opacity: 0.3 })
        expect(input[0].source.layer).toBe('TEST.WMTS')
        expect(second.layers.descriptors2D[0]).toMatchObject({ opacity: 1, source: { layer: 'TEST.WMTS' } })
        expect(second.layers.descriptors3D).toEqual(second.layers.descriptors2D)
    })

    it('rejects invalid descriptor changes without corrupting the current state', () => {
        const store = useLayersStore()
        const id = store.layers2D[0]
        const initial = JSON.parse(JSON.stringify(store.layerDescriptors))
        for (const opacity of [-0.1, 1.1, NaN, Infinity]) {
            expect(() => store.updateLayer(id, { opacity })).toThrow('invalide')
        }
        expect(() => store.updateLayer(id, { visible: 'false' })).toThrow('invalide')
        expect(() => store.updateLayer(id, { order: NaN })).toThrow('invalide')
        expect(() => store.updateLayer(id, { source: null })).toThrow('invalide')
        expect(() => store.updateLayer(id, { id: 'OTHER' })).toThrow('identifiant')
        expect(() => store.updateLayer('UNKNOWN', { opacity: 0 })).toThrow('inconnue')
        expect(() => store.addLayer('')).toThrow('invalide')
        expect(() => store.reorderLayers([id, id])).toThrow('exactement une fois')
        expect(() => store.reorderLayers(['UNKNOWN'])).toThrow('exactement une fois')
        expect(store.layerDescriptors).toEqual(initial)
    })
})
