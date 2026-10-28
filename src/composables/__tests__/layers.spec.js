import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { LayerWMTS } from 'geopf-extensions-openlayers'
import { GeopfWMTS } from 'geopf-extensions-itowns'
import { ELEVATION_LAYER_ID, useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useLoad2D, useDispose2D } from '../load2D'
import { useLoad3D, useDispose3D } from '../load3D'

const mocks = vi.hoisted(() => ({
    add2D: vi.fn(),
    add3D: vi.fn(async () => { }),
    addControl2D: vi.fn(),
    removeControl2D: vi.fn(),
    addControl3D: vi.fn(),
    removeControl3D: vi.fn(),
    dispose: vi.fn(),
}))

vi.mock('geopf-extensions-openlayers', async () => {
    const { default: TileLayer } = await import('ol/layer/Tile')
    const { default: Control } = await import('ol/control/Control')
    return {
        CRS: { load() { } },
        LayerWMTS: class extends TileLayer {
            constructor({ layer }) { super(); this.name = layer; this.layer = layer }
        },
        LayerSwitcher: class LayerSwitcher extends Control {
            constructor() { super({ element: document.createElement('div') }) }
        },
        MousePosition: class MousePosition extends Control {
            constructor() { super({ element: document.createElement('div') }) }
        },
    }
})
vi.mock('ol/Map', async (importOriginal) => {
    const { default: Map } = await importOriginal()
    return {
        default: class extends Map {
            addLayer(layer) { mocks.add2D(layer); return super.addLayer(layer) }
            addControl(control) { mocks.addControl2D(control); return super.addControl(control) }
            removeControl(control) { mocks.removeControl2D(control); return super.removeControl(control) }
        },
    }
})
vi.mock('itowns', () => ({
    Coordinates: class {
        constructor(crs, longitude, latitude) { Object.assign(this, { longitude, latitude }) }
    },
}))
vi.mock('ol/control/ScaleLine', () => ({ default: class Scale { setMap() { } } }))
vi.mock('geopf-extensions-itowns', async () => {
    const { EventDispatcher } = await import('three')
    class Layer extends EventDispatcher {
        constructor(options) {
            super()
            Object.assign(this, options)
            this.id = `${options.layer}:WMTS`
            this.source = {
                isWMTSSource: true,
                url: `http://example.test/wmts?LAYER=${encodeURIComponent(options.layer)}`,
            }
            this.isColorLayer = options.layer !== ELEVATION_LAYER_ID
            for (const [property, initial] of Object.entries({ visible: true, opacity: 1, sequence: 0 })) {
                let value = initial
                Object.defineProperty(this, property, {
                    get: () => value,
                    set: (next) => {
                        if (next === value) return
                        value = next
                        this.dispatchEvent({ type: `${property}-property-changed` })
                    },
                })
            }
        }
    }
    return {
        GeopfWMTS: Layer,
        GeopfElevation: class extends Layer { },
        Scale: class Scale { },
        LayerSwitcher: class LayerSwitcher { },
        MousePosition: class MousePosition { },
        GlobeViewExtended: class {
            static EVENTS = {
                GLOBE_INITIALIZED: 'initialized', CENTER_CHANGED: 'center', RANGE_CHANGED: 'range',
                LAYER_ADDED: 'added', LAYER_REMOVED: 'removed',
                VISIBLE_PROPERTY_CHANGED: 'visible-property-changed',
                OPACITY_PROPERTY_CHANGED: 'opacity-property-changed',
                SEQUENCE_PROPERTY_CHANGED: 'sequence-property-changed',
            }
            constructor(target, options) {
                Object.assign(this, { target, options, widgets: [], layers: new Map(), listeners: new Map() })
            }
            listen(event, callback) {
                this.listeners.set(event, callback)
                if (event === 'initialized') queueMicrotask(callback)
                return event
            }
            addLayerListener(layer, type, callback) {
                layer.addEventListener(type, callback)
                return { layer, type, callback }
            }
            forgetByKey(key) {
                if (typeof key === 'object') key.layer.removeEventListener(key.type, key.callback)
                else this.listeners.delete(key)
            }
            async addLayer(layer) {
                layer.sequence = [...this.layers.values()].filter((item) => item.isColorLayer).length
                this.layers.set(layer.id, layer)
                await mocks.add3D(layer)
                this.listeners.get('added')?.({ layerId: layer.id })
            }
            removeLayer(layerId) {
                this.layers.delete(layerId)
                this.listeners.get('removed')?.({ layerId })
            }
            setLayerVisibility(id, visible) { this.layers.get(id).visible = visible }
            setLayerOpacity(id, opacity) { this.layers.get(id).opacity = opacity }
            moveLayerToIndex(id, index) {
                const ordered = [...this.layers.values()].filter((layer) => layer.isColorLayer)
                    .sort((a, b) => a.sequence - b.sequence)
                const layer = this.layers.get(id)
                ordered.splice(ordered.indexOf(layer), 1)
                ordered.splice(index, 0, layer)
                ordered.forEach((item, order) => { item.sequence = order })
            }
            getCenter() { return { lon: this.options.coord.longitude, lat: this.options.coord.latitude } }
            getZoom() { return this.options.zoom }
            addWidget(widget) { this.widgets.push(widget); mocks.addControl3D(widget) }
            removeWidget(widget) { mocks.removeControl3D(widget) }
            getWidgets() { return this.widgets }
            getTargetElement() { return this.target }
            getGlobeView() {
                return {
                    resize() { },
                    getLayerById: (id) => this.layers.get(id),
                    dispose: mocks.dispose,
                    mainLoop: { gfxEngine: { renderer: { dispose() { } } } },
                }
            }
        },
    }
})

describe('store-driven map layers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
        useControlsStore().controlIds = ['LayerSwitcher']
        vi.stubGlobal('ResizeObserver', class {
            observe() { }
            unobserve() { }
            disconnect() { }
        })
    })

    afterEach(() => {
        useDispose2D()
        useDispose3D()
        vi.unstubAllGlobals()
    })

    it('loads shared layers in both views, with elevation only in 3D', async () => {
        const store = useLayersStore()
        await useLoad2D(document.createElement('div'), store)
        await useLoad3D(document.createElement('div'), store)
        expect(mocks.add2D.mock.calls.map(([layer]) => layer.layer)).toEqual(store.layers2D)
        expect(mocks.add3D.mock.calls.map(([layer]) => layer.layer)).toEqual(store.layers3D)
        expect(mocks.add2D.mock.calls.map(([layer]) => layer.layer)).not.toContain(ELEVATION_LAYER_ID)
        expect(mocks.add3D.mock.calls.every(([layer]) => layer.source.url.startsWith('https:'))).toBe(true)
    })

    it('propagates additions once and stops observing after disposal', async () => {
        const store = useLayersStore()
        await useLoad2D(document.createElement('div'), store)
        await useLoad3D(document.createElement('div'), store)
        store.addLayer('TEST.WMTS')
        store.addLayer('TEST.WMTS')
        await nextTick()
        await vi.waitFor(() => {
            expect(mocks.add3D).toHaveBeenCalledTimes(4)
        })
        expect(mocks.add2D).toHaveBeenCalledTimes(3)
        useDispose2D()
        useDispose3D()
        store.addLayer('OTHER.WMTS')
        await nextTick()
        expect(mocks.add2D).toHaveBeenCalledTimes(3)
        expect(mocks.add3D).toHaveBeenCalledTimes(4)
    })

    it('shares reactive controls without duplicates and cleans them up', async () => {
        const controls = useControlsStore()
        await useLoad2D(document.createElement('div'), useLayersStore(), controls)
        await useLoad3D(document.createElement('div'), useLayersStore(), controls)
        expect(mocks.addControl2D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher'])
        expect(mocks.addControl3D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher'])
        controls.addControl('Scale')
        controls.addControl('Scale')
        controls.addControl('MousePosition')
        await nextTick()
        expect(mocks.addControl2D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher', 'Scale', 'MousePosition'])
        expect(mocks.addControl3D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher', 'Scale', 'MousePosition'])
        useDispose2D()
        useDispose3D()
        expect(mocks.removeControl2D).toHaveBeenCalledTimes(3)
        expect(mocks.removeControl3D).toHaveBeenCalledTimes(3)
        controls.controlIds = []
        controls.addControl('Scale')
        await nextTick()
        expect(mocks.addControl2D).toHaveBeenCalledTimes(3)
        expect(mocks.addControl3D).toHaveBeenCalledTimes(3)
    })

    it('shares store removals and allows adding the same layer again', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const id = store.layers2D[0]
        store.removeLayer(id)
        await vi.waitFor(() => expect(globe.layers.has(`${id}:WMTS`)).toBe(false))
        expect(map.getLayers().getArray().some((layer) => layer.name === id)).toBe(false)
        store.addLayer(id)
        await vi.waitFor(() => expect(globe.layers.has(`${id}:WMTS`)).toBe(true))
        expect(map.getLayers().getArray().filter((layer) => layer.name === id)).toHaveLength(1)
        expect(mocks.add3D).toHaveBeenCalledTimes(4)
    })

    it('shares additions and removals performed directly in 3D', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const id = store.layers2D[0]
        globe.removeLayer(`${id}:WMTS`)
        await nextTick()
        expect(store.layers2D).not.toContain(id)
        expect(map.getLayers().getArray().some((layer) => layer.name === id)).toBe(false)
        await globe.addLayer(new GeopfWMTS({ layer: id }))
        await nextTick()
        expect(store.layers2D).toContain(id)
        expect(map.getLayers().getArray().filter((layer) => layer.name === id)).toHaveLength(1)
        expect(mocks.add3D).toHaveBeenCalledTimes(4)
    })

    it('shares additions and removals performed directly in 2D', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const layer = map.getLayers().item(0)
        map.removeLayer(layer)
        await vi.waitFor(() => expect(globe.layers.has(`${layer.name}:WMTS`)).toBe(false))
        expect(store.layers2D).not.toContain(layer.name)
        map.addLayer(new LayerWMTS({ layer: layer.name }))
        await vi.waitFor(() => expect(globe.layers.has(`${layer.name}:WMTS`)).toBe(true))
        expect(store.layers2D.filter((id) => id === layer.name)).toHaveLength(1)
    })

    it('does not resurrect a layer removed while its 3D addition is pending', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        let finishAdding
        mocks.add3D.mockImplementationOnce(() => new Promise((resolve) => { finishAdding = resolve }))
        store.addLayer('TEST.WMTS')
        await vi.waitFor(() => expect(finishAdding).toBeTypeOf('function'))
        store.removeLayer('TEST.WMTS')
        await nextTick()
        finishAdding()
        await vi.waitFor(() => expect(globe.layers.has('TEST.WMTS:WMTS')).toBe(false))
        expect(store.layers2D).not.toContain('TEST.WMTS')
        expect(map.getLayers().getArray().some((layer) => layer.name === 'TEST.WMTS')).toBe(false)
    })

    it('stops forwarding map layer events after disposal', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const initialIds = [...store.layerIds]
        useDispose2D()
        useDispose3D()
        map.removeLayer(map.getLayers().item(0))
        globe.removeLayer(`${initialIds[0]}:WMTS`)
        expect(store.layerIds).toEqual(initialIds)
    })

    it('uses the latest descriptors on the first 3D load and reconciles changes without recreating layers', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const [first, second] = store.layers2D
        store.updateLayer(first, { visible: false, opacity: 0.25 })
        store.reorderLayers([second, first])
        await nextTick()
        const globe = await useLoad3D(document.createElement('div'), store)
        const image2D = map.getLayers().getArray().find((layer) => layer.name === first)
        const image3D = globe.layers.get(`${first}:WMTS`)
        expect(image2D.getVisible()).toBe(false)
        expect(image2D.getOpacity()).toBe(0.25)
        expect(image2D.getZIndex()).toBe(2)
        expect(image3D.visible).toBe(false)
        expect(image3D.opacity).toBe(0.25)
        expect(image3D.sequence).toBe(1)

        store.updateLayer(first, { visible: true, opacity: 0 })
        store.reorderLayers([first, second])
        await vi.waitFor(() => expect(image3D.sequence).toBe(0))
        expect(image3D.visible).toBe(true)
        expect(image3D.opacity).toBe(0)
        expect(image2D.getZIndex()).toBe(1)
        expect(image2D.getOpacity()).toBe(0)
        expect(map.getLayers().getArray().find((layer) => layer.name === first)).toBe(image2D)
        expect(globe.layers.get(`${first}:WMTS`)).toBe(image3D)
        expect(mocks.add2D).toHaveBeenCalledTimes(2)
        expect(mocks.add3D).toHaveBeenCalledTimes(3)
        expect(store.layers3D.at(-1)).toBe(ELEVATION_LAYER_ID)
    })

    it('propagates visibility, opacity and order from either layer manager without feedback', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const [first, second] = store.layers2D
        const layer2D = map.getLayers().getArray().find((layer) => layer.name === first)
        const layer3D = globe.layers.get(`${first}:WMTS`)
        layer2D.setVisible(false)
        layer2D.setOpacity(0.35)
        layer2D.setZIndex(20)
        await vi.waitFor(() => expect(layer3D.sequence).toBe(1))
        expect(layer3D.visible).toBe(false)
        expect(layer3D.opacity).toBe(0.35)
        expect(store.layers2D).toEqual([second, first])

        globe.setLayerVisibility(layer3D.id, true)
        globe.setLayerOpacity(layer3D.id, 0.8)
        globe.moveLayerToIndex(layer3D.id, 0)
        await vi.waitFor(() => expect(layer2D.getOpacity()).toBe(0.8))
        expect(layer2D.getVisible()).toBe(true)
        expect(layer2D.getZIndex()).toBe(1)
        expect(store.layers2D).toEqual([first, second])
        expect(store.descriptors2D[0]).toMatchObject({ id: first, visible: true, opacity: 0.8, order: 0 })
        expect(mocks.add2D).toHaveBeenCalledTimes(2)
        expect(mocks.add3D).toHaveBeenCalledTimes(3)
    })

    it('captures properties of layers added directly in either engine', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const layer2D = new LayerWMTS({ layer: 'FROM.2D' })
        layer2D.setVisible(false)
        layer2D.setOpacity(0.2)
        map.addLayer(layer2D)
        await vi.waitFor(() => expect(globe.layers.get('FROM.2D:WMTS')?.opacity).toBe(0.2))
        expect(globe.layers.get('FROM.2D:WMTS').visible).toBe(false)
        const layer3D = new GeopfWMTS({ layer: 'FROM.3D' })
        layer3D.visible = false
        layer3D.opacity = 0.6
        await globe.addLayer(layer3D)
        await vi.waitFor(() => expect(map.getLayers().getArray().some((layer) => layer.name === 'FROM.3D')).toBe(true))
        const mirrored = map.getLayers().getArray().find((layer) => layer.name === 'FROM.3D')
        expect(mirrored.getVisible()).toBe(false)
        expect(mirrored.getOpacity()).toBe(0.6)
    })

    it('applies descriptor changes made during a pending 3D layer addition', async () => {
        const store = useLayersStore()
        await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        let finishAdding
        mocks.add3D.mockImplementationOnce(() => new Promise((resolve) => { finishAdding = resolve }))
        store.addLayer({ id: 'TEST', visible: true, opacity: 1 })
        await vi.waitFor(() => expect(finishAdding).toBeTypeOf('function'))
        store.updateLayer('TEST', { visible: false, opacity: 0.1, order: -1 })
        await nextTick()
        finishAdding()
        await vi.waitFor(() => expect(globe.layers.get('TEST:WMTS').opacity).toBe(0.1))
        expect(globe.layers.get('TEST:WMTS').visible).toBe(false)
        expect(globe.layers.get('TEST:WMTS').sequence).toBe(0)
        expect(store.descriptors2D[0]).toMatchObject({ id: 'TEST', opacity: 0.1, visible: false })
    })

    it('rebuilds changed WMTS sources without changing shared identifiers', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const id = store.layers2D[0]
        store.updateLayer(id, { source: { layer: 'OTHER.WMTS' }, opacity: 0.45, visible: false })
        await vi.waitFor(() => expect(globe.layers.has('OTHER.WMTS:WMTS')).toBe(true))
        expect(globe.layers.has(`${id}:WMTS`)).toBe(false)
        expect(globe.layers.get('OTHER.WMTS:WMTS')).toMatchObject({ opacity: 0.45, visible: false })
        const replacement = map.getLayers().getArray().find((layer) => layer.name === 'OTHER.WMTS')
        expect(replacement.getOpacity()).toBe(0.45)
        expect(store.layers2D).toContain(id)
        expect(store.layers2D).not.toContain('OTHER.WMTS')
        globe.removeLayer('OTHER.WMTS:WMTS')
        await nextTick()
        expect(store.layers2D).not.toContain(id)
        expect(map.getLayers().getArray().some((layer) => layer.name === 'OTHER.WMTS')).toBe(false)
    })

    it('does not overwrite pending layer properties when another 3D layer changes', async () => {
        const store = useLayersStore()
        const globe = await useLoad3D(document.createElement('div'), store)
        const first = store.layers2D[0]
        let finishAdding
        mocks.add3D.mockImplementationOnce(() => new Promise((resolve) => { finishAdding = resolve }))
        store.addLayer({ id: 'PENDING', visible: false, opacity: 0.15 })
        await vi.waitFor(() => expect(finishAdding).toBeTypeOf('function'))
        globe.setLayerOpacity(`${first}:WMTS`, 0.6)
        await nextTick()
        expect(store.descriptors2D.find(({ id }) => id === 'PENDING')).toMatchObject({ visible: false, opacity: 0.15 })
        finishAdding()
        await vi.waitFor(() => expect(globe.layers.get('PENDING:WMTS').opacity).toBe(0.15))
        expect(globe.layers.get('PENDING:WMTS').visible).toBe(false)
        expect(store.descriptors2D.find(({ id }) => id === first).opacity).toBe(0.6)
    })

    it('detaches property listeners and cancels queued publications when disposed', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await useLoad3D(document.createElement('div'), store)
        const layer2D = map.getLayers().item(0)
        const layer3D = globe.layers.get(`${store.layers2D[0]}:WMTS`)
        const initial = JSON.parse(JSON.stringify(store.layerDescriptors))
        layer2D.setOpacity(0.1)
        layer3D.visible = false
        useDispose2D()
        useDispose3D()
        await nextTick()
        layer2D.setVisible(false)
        layer3D.opacity = 0.2
        await nextTick()
        expect(store.layerDescriptors).toEqual(initial)
    })
})
