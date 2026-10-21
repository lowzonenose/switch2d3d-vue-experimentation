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
vi.mock('geopf-extensions-itowns', () => {
    class Layer {
        constructor(options) {
            Object.assign(this, options)
            this.id = `${options.layer}:WMTS`
            this.source = {
                isWMTSSource: true,
                url: `http://example.test/wmts?LAYER=${encodeURIComponent(options.layer)}`,
            }
            this.isColorLayer = options.layer !== ELEVATION_LAYER_ID
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
            }
            constructor(target, options) {
                Object.assign(this, { target, options, widgets: [], layers: new Map(), listeners: new Map() })
            }
            listen(event, callback) {
                this.listeners.set(event, callback)
                if (event === 'initialized') queueMicrotask(callback)
                return event
            }
            forgetByKey(key) { this.listeners.delete(key) }
            async addLayer(layer) {
                this.layers.set(layer.id, layer)
                await mocks.add3D(layer)
                this.listeners.get('added')?.({ layerId: layer.id })
            }
            removeLayer(layerId) {
                this.layers.delete(layerId)
                this.listeners.get('removed')?.({ layerId })
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
})
