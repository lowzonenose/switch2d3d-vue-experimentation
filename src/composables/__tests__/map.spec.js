import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { fromLonLat } from 'ol/proj'
import { useMapStore } from '@/stores/map'
import { useLoad2D, useDispose2D } from '../load2D'
import { useLoad3D, useDispose3D } from '../load3D'
import { createMap2D, createMap3D, createMapState, loadMapConfig } from '../../maps/index.js'

const configMocks = vi.hoisted(() => ({ call: vi.fn() }))

vi.mock('geoportal-access-lib', () => ({
    default: {
        Services: {
            Config: class {
                constructor(options) { this.options = options }
                call() { configMocks.call(this.options) }
            },
        },
    },
}))

vi.mock('itowns', () => ({
    Coordinates: class {
        constructor(crs, longitude, latitude) {
            Object.assign(this, { crs, longitude, latitude })
        }
    },
}))

vi.mock('geopf-extensions-itowns', () => ({
    GeopfElevation: class { },
    GeopfWMTS: class { },
    LayerSwitcher: class { },
    Scale: class { },
    MousePosition: class { },
    GlobeViewExtended: class {
        static EVENTS = { GLOBE_INITIALIZED: 'initialized', CENTER_CHANGED: 'center', RANGE_CHANGED: 'range' }
        constructor(target, options) {
            this.target = target
            this.center = options.coord
            this.zoom = options.zoom
            this.listeners = new Map()
            this.view = {
                resize() { },
                dispose() { },
                mainLoop: { gfxEngine: { renderer: { dispose() { } } } },
                tileLayer: { computeDistanceCameraFromTileZoom: (zoom) => 2 ** -zoom },
                controls: {
                    lookAtCoordinate: vi.fn(async ({ coord, range }) => {
                        this.center = coord
                        this.zoom = -Math.log2(range)
                        this.emit('center')
                        this.emit('range')
                    }),
                },
            }
        }
        listen(event, callback) {
            this.listeners.set(event, callback)
            if (event === 'initialized') queueMicrotask(callback)
            return event
        }
        forgetByKey(key) { this.listeners.delete(key) }
        emit(event) { this.listeners.get(event)?.() }
        getCenter() { return { lon: this.center.longitude, lat: this.center.latitude } }
        getZoom() { return this.zoom }
        getGlobeView() { return this.view }
        getWidgets() { return [] }
        getTargetElement() { return this.target }
    },
}))

vi.mock('geopf-extensions-openlayers', () => ({
    CRS: { load: vi.fn() },
    LayerWMTS: class { },
    LayerSwitcher: class { },
    MousePosition: class { },
}))

describe('shared map parameters', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        configMocks.call.mockReset().mockImplementation((options) => options.onSuccess())
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

    it('loads a configurable catalog and propagates configuration failures', async () => {
        await loadMapConfig({ url: 'https://example.test/config.json', timeout: 5000 })
        expect(configMocks.call).toHaveBeenCalledWith(expect.objectContaining({
            customConfigFile: 'https://example.test/config.json', timeOut: 5000,
        }))
        configMocks.call.mockImplementationOnce((options) => options.onFailure(new Error('Unavailable catalog')))
        await expect(loadMapConfig()).rejects.toThrow('Unavailable catalog')
    })

    it('supports independent map pairs without Pinia and disposes each pair separately', async () => {
        setActivePinia(undefined)
        const firstState = createMapState({ layerIds: [], controlIds: [], elevationLayerId: null })
        const secondState = createMapState({
            coordinates: { longitude: 4.8, latitude: 45.7 }, zoom: 8,
            layerIds: [], controlIds: [], elevationLayerId: null,
        })
        const first2D = createMap2D(firstState)
        const first3D = createMap3D(firstState)
        const second2D = createMap2D(secondState)
        const second3D = createMap3D(secondState)
        try {
            const firstMap = await first2D.load(document.createElement('div'))
            const firstGlobe = await first3D.load(document.createElement('div'))
            const secondMap = await second2D.load(document.createElement('div'))
            const secondGlobe = await second3D.load(document.createElement('div'))
            firstState.view.setView({ longitude: 5.4, latitude: 43.3 }, 12)
            await vi.waitFor(() => expect(firstGlobe.getZoom()).toBe(12))
            expect(firstMap.getView().getCenter()).toEqual(fromLonLat([5.4, 43.3]))
            expect(secondMap.getView().getZoom()).toBe(8)
            expect(secondGlobe.getCenter()).toEqual({ lon: 4.8, lat: 45.7 })
            first2D.dispose()
            first3D.dispose()
            firstState.view.zoom = 9
            secondState.view.zoom = 13
            await vi.waitFor(() => expect(secondGlobe.getZoom()).toBe(13))
            expect(firstMap.getView().getZoom()).toBe(12)
            expect(firstGlobe.getZoom()).toBe(12)
            expect(secondMap.getView().getZoom()).toBe(13)
        } finally {
            first2D.dispose()
            first3D.dispose()
            second2D.dispose()
            second3D.dispose()
        }
    })

    it('cancels pending 3D initialization and can load a new target safely', async () => {
        const state = createMapState({ layerIds: [], controlIds: [], elevationLayerId: null })
        const controller = createMap3D(state)
        try {
            const cancelled = controller.load(document.createElement('div'))
            controller.dispose()
            const loading = controller.load(document.createElement('div'))
            await expect(cancelled).resolves.toBeUndefined()
            const globe = await loading
            state.view.zoom = 12
            await vi.waitFor(() => expect(globe.getZoom()).toBe(12))
        } finally {
            controller.dispose()
        }
    })

    it('initializes 2D from the store and propagates changes in both directions', async () => {
        const store = useMapStore()
        const map = await useLoad2D(document.createElement('div'), { layers2D: [] }, { controls2D: [] }, store)
        const view = map.getView()
        expect(view.getCenter()).toEqual(fromLonLat([2.3465, 48.88]))
        expect(view.getZoom()).toBe(10)

        store.coordinates.longitude = 4.8
        store.coordinates.latitude = 45.7
        store.zoom = 12
        await nextTick()
        expect(view.getCenter()).toEqual(fromLonLat([4.8, 45.7]))
        expect(view.getZoom()).toBe(12)

        view.setCenter(fromLonLat([5.4, 43.3]))
        view.setZoom(11)
        map.dispatchEvent('moveend')
        expect(store.coordinates.longitude).toBeCloseTo(5.4)
        expect(store.coordinates.latitude).toBeCloseTo(43.3)
        expect(store.zoom).toBe(11)

        useDispose2D()
        store.zoom = 8
        await nextTick()
        expect(view.getZoom()).toBe(11)
        view.setZoom(7)
        map.dispatchEvent('moveend')
        expect(store.zoom).toBe(8)
    })

    it('shares store changes and navigation between 2D and 3D without feedback', async () => {
        const store = useMapStore()
        const map = await useLoad2D(document.createElement('div'), { layers2D: [] }, { controls2D: [] }, store)
        const globe = await useLoad3D(document.createElement('div'), { layers3D: [] }, { controls3D: [] }, store)
        expect(globe.getCenter().lon).toBe(store.coordinates.longitude)
        expect(globe.getZoom()).toBe(store.zoom)

        store.coordinates = { longitude: 4.8, latitude: 45.7 }
        store.zoom = 0
        await nextTick()
        await vi.waitFor(() => expect(globe.getZoom()).toBeCloseTo(0))
        expect(globe.getCenter().lon).toBe(4.8)
        expect(map.getView().getZoom()).toBe(0)

        globe.center = { longitude: 5.4, latitude: 43.3 }
        globe.zoom = 11
        globe.emit('center')
        await nextTick()
        expect(store.coordinates).toEqual({ longitude: 5.4, latitude: 43.3 })
        expect(map.getView().getCenter()).toEqual(fromLonLat([5.4, 43.3]))
        expect(map.getView().getZoom()).toBe(11)

        map.getView().setZoom(12)
        map.dispatchEvent('moveend')
        await nextTick()
        await vi.waitFor(() => expect(globe.getZoom()).toBe(12))
        expect(globe.getGlobeView().controls.lookAtCoordinate).toHaveBeenCalledTimes(2)

        useDispose3D()
        store.zoom = 8
        await nextTick()
        expect(globe.getZoom()).toBe(12)
        globe.zoom = 7
        globe.emit('range')
        expect(store.zoom).toBe(8)
    })

    it('applies the latest parameters during initialization and an ongoing update', async () => {
        const store = useMapStore()
        const loading = useLoad3D(document.createElement('div'), { layers3D: [] }, { controls3D: [] }, store)
        store.setView({ longitude: 4.8, latitude: 45.7 }, 12)
        const globe = await loading
        await vi.waitFor(() => expect(globe.getZoom()).toBe(12))
        expect(globe.getCenter()).toEqual({ lon: 4.8, lat: 45.7 })

        const controls = globe.getGlobeView().controls
        const apply = controls.lookAtCoordinate.getMockImplementation()
        let completeUpdate
        controls.lookAtCoordinate.mockImplementationOnce(async (parameters) => {
            await new Promise((resolve) => { completeUpdate = resolve })
            return apply(parameters)
        })
        store.zoom = 13
        await nextTick()
        store.setView({ longitude: 5.4, latitude: 43.3 }, 9)
        await nextTick()
        completeUpdate()
        await vi.waitFor(() => expect(globe.getZoom()).toBe(9))
        expect(globe.getCenter()).toEqual({ lon: 5.4, lat: 43.3 })
        expect(store.zoom).toBe(9)
        expect(store.coordinates).toEqual({ longitude: 5.4, latitude: 43.3 })
    })
})
