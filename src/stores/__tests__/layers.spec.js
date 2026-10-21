import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ELEVATION_LAYER_ID, useLayersStore } from '../layers'

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
})
