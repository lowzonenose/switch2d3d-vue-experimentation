import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { LayerWMTS } from 'geopf-extensions-openlayers'
import { GeopfWMTS } from 'geopf-extensions-itowns'
import { ELEVATION_LAYER_ID, useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'
import { createMapState } from '@/maps/state.js'
import { useLoad2D, useDispose2D } from '../load2D'
import { createMap3D } from '@portail/map3d/core'

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
        GeopfElevation: class extends Layer {
            constructor(options) { super(options); this.isColorLayer = false }
        },
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
            removeWidget(widget) {
                this.widgets = this.widgets.filter((item) => item !== widget)
                mocks.removeControl3D(widget)
            }
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
    let controller3D

    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
        useControlsStore().controlIds = ['LayerSwitcher']
        controller3D = createMap3D({
            layers: useLayersStore(),
            controls: useControlsStore(),
            view: useMapStore(),
            elevationLayerId: ELEVATION_LAYER_ID,
        })
        vi.stubGlobal('ResizeObserver', class {
            observe() { }
            unobserve() { }
            disconnect() { }
        })
    })

    afterEach(() => {
        useDispose2D()
        controller3D.dispose()
        vi.unstubAllGlobals()
    })

    it('loads shared layers in both views, with elevation only in 3D', async () => {
        const store = useLayersStore()
        await useLoad2D(document.createElement('div'), store)
        await controller3D.load(document.createElement('div'))
        expect(mocks.add2D.mock.calls.map(([layer]) => layer.layer)).toEqual(store.layers2D)
        expect(mocks.add3D.mock.calls.map(([layer]) => layer.layer)).toEqual(store.layers3D)
        expect(mocks.add2D.mock.calls.map(([layer]) => layer.layer)).not.toContain(ELEVATION_LAYER_ID)
        expect(mocks.add3D.mock.calls.every(([layer]) => layer.source.url.startsWith('https:'))).toBe(true)
    })

    it('uses the host elevation descriptor without a library-owned layer ID', async () => {
        const state = createMapState({
            layerIds: ['HOST.IMAGERY'], elevationLayerId: 'HOST.ELEVATION', controlIds: [],
        })
        const { view, layers, controls } = state
        const controller = createMap3D({ view, layers, controls })
        const removeLayer = vi.spyOn(layers, 'removeLayer')
        try {
            const globe = await controller.load(document.createElement('div'))
            expect(globe.layers.get('HOST.ELEVATION:WMTS').isColorLayer).toBe(false)
            expect(globe.layers.get('HOST.IMAGERY:WMTS').isColorLayer).toBe(true)
            globe.removeLayer('HOST.ELEVATION:WMTS')
            expect(removeLayer).not.toHaveBeenCalled()
            expect(layers.layers2D).toEqual(['HOST.IMAGERY'])
        } finally {
            controller.dispose()
        }
    })

    it('supports host-provided legacy layer IDs and an explicit elevation ID', async () => {
        const layers = reactive({
            layers2D: ['HOST.IMAGERY'],
            layers3D: ['HOST.IMAGERY', 'HOST.ELEVATION'],
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
        })
        const controller = createMap3D({
            view: useMapStore(), layers, controls: { controls3D: [] }, elevationLayerId: 'HOST.ELEVATION',
        })
        try {
            const globe = await controller.load(document.createElement('div'))
            expect(globe.layers.get('HOST.IMAGERY:WMTS').isColorLayer).toBe(true)
            expect(globe.layers.get('HOST.ELEVATION:WMTS').isColorLayer).toBe(false)
        } finally {
            controller.dispose()
        }
    })

    it('rejects invalid legacy layer identifiers supplied by the host', async () => {
        const controller = createMap3D({
            view: useMapStore(), layers: { layers3D: [''] }, controls: { controls3D: [] },
        })
        try {
            await expect(controller.load(document.createElement('div'))).rejects.toThrow('Identifiant de couche invalide')
        } finally {
            controller.dispose()
        }
    })

    it('reconciles host layer changes made during initial 3D loading', async () => {
        const layers = useLayersStore()
        const firstId = layers.layers2D[0]
        let finishAdding
        mocks.add3D.mockImplementationOnce(() => new Promise((resolve) => { finishAdding = resolve }))
        const loading = controller3D.load(document.createElement('div'))
        await vi.waitFor(() => expect(finishAdding).toBeTypeOf('function'))

        layers.updateLayer(firstId, { visible: false, opacity: 0.25 })
        layers.addLayer('HOST.PENDING')
        await nextTick()
        finishAdding()

        const globe = await loading
        await vi.waitFor(() => expect(globe.layers.has('HOST.PENDING:WMTS')).toBe(true))
        expect(globe.layers.get(`${firstId}:WMTS`)).toMatchObject({ visible: false, opacity: 0.25 })
    })

    it('observes enabled 3D layer IDs separately from host descriptors', async () => {
        const layers = reactive({
            layers2D: ['HOST.A', 'HOST.B'],
            layers3D: ['HOST.A'],
            descriptors3D: ['HOST.A', 'HOST.B'].map((id, order) => ({
                id, type: 'WMTS', visible: true, opacity: 1, order, source: { layer: id },
            })),
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
        })
        const controller = createMap3D({ view: useMapStore(), controls: { controls3D: [] }, layers })
        try {
            const globe = await controller.load(document.createElement('div'))
            expect(globe.layers.has('HOST.A:WMTS')).toBe(true)
            expect(globe.layers.has('HOST.B:WMTS')).toBe(false)

            layers.layers3D.push('HOST.B')
            await vi.waitFor(() => expect(globe.layers.has('HOST.B:WMTS')).toBe(true))
            layers.layers3D.splice(0, 1)
            await vi.waitFor(() => expect(globe.layers.has('HOST.A:WMTS')).toBe(false))
            expect(layers.removeLayer).not.toHaveBeenCalled()
        } finally {
            controller.dispose()
        }
    })

    it('publishes 3D-only layer changes to the host', async () => {
        const id = 'HOST.3D'
        const layers = reactive({
            layers2D: [],
            layers3D: [id],
            descriptors3D: [{ id, type: 'WMTS', visible: true, opacity: 1, order: 0, source: { layer: id } }],
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            updateLayer: vi.fn(),
        })
        const controller = createMap3D({ view: useMapStore(), controls: { controls3D: [] }, layers })
        try {
            const globe = await controller.load(document.createElement('div'))
            globe.setLayerOpacity(`${id}:WMTS`, 0.4)
            await vi.waitFor(() => expect(layers.updateLayer).toHaveBeenCalledWith(id, { opacity: 0.4 }))
        } finally {
            controller.dispose()
        }
    })

    it('propagates additions once and stops observing after disposal', async () => {
        const store = useLayersStore()
        await useLoad2D(document.createElement('div'), store)
        await controller3D.load(document.createElement('div'))
        store.addLayer('TEST.WMTS')
        store.addLayer('TEST.WMTS')
        await nextTick()
        await vi.waitFor(() => {
            expect(mocks.add3D).toHaveBeenCalledTimes(4)
        })
        expect(mocks.add2D).toHaveBeenCalledTimes(3)
        useDispose2D()
        controller3D.dispose()
        store.addLayer('OTHER.WMTS')
        await nextTick()
        expect(mocks.add2D).toHaveBeenCalledTimes(3)
        expect(mocks.add3D).toHaveBeenCalledTimes(4)
    })

    it('shares reactive controls without duplicates and cleans them up', async () => {
        const controls = useControlsStore()
        await useLoad2D(document.createElement('div'), useLayersStore(), controls)
        await controller3D.load(document.createElement('div'))
        expect(mocks.addControl2D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher'])
        expect(mocks.addControl3D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher'])
        controls.addControl('Scale')
        controls.addControl('Scale')
        controls.addControl('MousePosition')
        await nextTick()
        expect(mocks.addControl2D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher', 'Scale', 'MousePosition'])
        expect(mocks.addControl3D.mock.calls.map(([control]) => control.constructor.name)).toEqual(['LayerSwitcher', 'Scale', 'MousePosition'])
        useDispose2D()
        controller3D.dispose()
        expect(mocks.removeControl2D).toHaveBeenCalledTimes(3)
        expect(mocks.removeControl3D).toHaveBeenCalledTimes(3)
        controls.controlIds = []
        controls.addControl('Scale')
        await nextTick()
        expect(mocks.addControl2D).toHaveBeenCalledTimes(3)
        expect(mocks.addControl3D).toHaveBeenCalledTimes(3)
    })

    it('observes in-place changes to the host 3D control list', async () => {
        const controls = reactive({ controls3D: ['LayerSwitcher'] })
        const controller = createMap3D({ view: useMapStore(), layers: useLayersStore(), controls })
        try {
            await controller.load(document.createElement('div'))
            controls.controls3D.push('Scale')
            await nextTick()
            expect(mocks.addControl3D.mock.calls.map(([control]) => control.constructor.name))
                .toEqual(['LayerSwitcher', 'Scale'])
            controls.controls3D.splice(0, 1)
            await nextTick()
            expect(mocks.removeControl3D.mock.calls.map(([control]) => control.constructor.name))
                .toEqual(['LayerSwitcher'])
        } finally {
            controller.dispose()
        }
    })

    it('removes and restores controls when the 3D control list changes', async () => {
        const controls = useControlsStore()
        await controller3D.load(document.createElement('div'))
        const widget = mocks.addControl3D.mock.calls[0][0]
        controls.controlIds = []
        await nextTick()
        expect(mocks.removeControl3D).toHaveBeenCalledExactlyOnceWith(widget)
        controls.controlIds = ['LayerSwitcher']
        await nextTick()
        expect(mocks.addControl3D).toHaveBeenCalledTimes(2)
        controller3D.dispose()
        expect(mocks.removeControl3D).toHaveBeenCalledTimes(2)
    })

    it('shares store removals and allows adding the same layer again', async () => {
        const store = useLayersStore()
        const map = await useLoad2D(document.createElement('div'), store)
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
        const initialIds = [...store.layerIds]
        useDispose2D()
        controller3D.dispose()
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
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
        const globe = await controller3D.load(document.createElement('div'))
        const layer2D = map.getLayers().item(0)
        const layer3D = globe.layers.get(`${store.layers2D[0]}:WMTS`)
        const initial = JSON.parse(JSON.stringify(store.layerDescriptors))
        layer2D.setOpacity(0.1)
        layer3D.visible = false
        useDispose2D()
        controller3D.dispose()
        await nextTick()
        layer2D.setVisible(false)
        layer3D.opacity = 0.2
        await nextTick()
        expect(store.layerDescriptors).toEqual(initial)
    })
})
