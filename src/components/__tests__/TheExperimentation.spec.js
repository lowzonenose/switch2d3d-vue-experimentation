import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import TheExperimentation from '../TheExperimentation.vue'
import Patience from '../Patience.vue'
import { createMap2D } from '@/maps/createMap2D.js'
import { createMap3D } from '@/maps/createMap3D.js'
import { useGetConfig } from '@/composables/getConfig'

vi.mock('@/composables/getConfig', () => ({ useGetConfig: vi.fn() }))
vi.mock('@/maps/createMap2D.js', () => ({
    createMap2D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
}))
vi.mock('@/maps/createMap3D.js', () => ({
    createMap3D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
}))

describe('TheExperimentation', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => vi.restoreAllMocks())

    it('creates 3D only on the first toggle and reuses both maps afterwards', async () => {
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        const toggle = wrapper.get('[role="switch"]')
        const map2d = wrapper.get('#map2d')

        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(toggle.attributes('aria-controls')).toBe('map2d map3d')
        expect(map2d.classes()).not.toContain('map-hidden')
        expect(wrapper.find('#map3d').exists()).toBe(false)
        expect(createMap3D).not.toHaveBeenCalled()
        const options2D = createMap2D.mock.calls[0][0]
        expect(options2D.isActive()).toBe(true)

        await toggle.trigger('click')
        await vi.waitFor(() => expect(toggle.attributes('aria-checked')).toBe('true'))
        const map3d = wrapper.get('#map3d')
        const options3D = createMap3D.mock.calls[0][0]
        expect(options2D.isActive()).toBe(false)
        expect(options3D.isActive()).toBe(true)

        expect(toggle.attributes('aria-checked')).toBe('true')
        expect(map2d.classes()).toContain('map-hidden')
        expect(map2d.attributes('inert')).toBeDefined()
        expect(map3d.classes()).not.toContain('map-hidden')
        expect(map3d.attributes('aria-hidden')).toBe('false')
        expect(map3d.attributes('inert')).toBeUndefined()

        await toggle.trigger('click')

        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(options2D.isActive()).toBe(true)
        expect(options3D.isActive()).toBe(false)
        expect(map2d.classes()).not.toContain('map-hidden')
        expect(map2d.attributes('inert')).toBeUndefined()
        expect(map3d.classes()).toContain('map-hidden')
        expect(wrapper.get('#map2d').element).toBe(map2d.element)
        expect(wrapper.get('#map3d').element).toBe(map3d.element)
        await toggle.trigger('click')
        expect(toggle.attributes('aria-checked')).toBe('true')
        expect(wrapper.get('#map3d').element).toBe(map3d.element)
        expect(createMap3D).toHaveBeenCalledTimes(1)
        const controller2D = createMap2D.mock.results[0].value
        const controller3D = createMap3D.mock.results[0].value
        expect(controller2D.load).toHaveBeenCalledExactlyOnceWith(map2d.element)
        expect(controller3D.load).toHaveBeenCalledExactlyOnceWith(map3d.element)
        for (const key of ['layers', 'controls', 'view']) {
            expect(options2D[key]).toBe(options3D[key])
        }

        wrapper.unmount()
        expect(controller2D.dispose).toHaveBeenCalledTimes(1)
        expect(controller3D.dispose).toHaveBeenCalledTimes(1)
        expect(options2D.isActive()).toBe(false)
        expect(options3D.isActive()).toBe(false)
    })

    it('does not load maps when unmounted before configuration is ready', async () => {
        let finishConfig
        useGetConfig.mockReturnValueOnce(new Promise((resolve) => { finishConfig = resolve }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        wrapper.unmount()
        finishConfig()
        await flushPromises()
        expect(createMap2D.mock.results[0].value.load).not.toHaveBeenCalled()
        expect(createMap3D).not.toHaveBeenCalled()
        expect(createMap2D.mock.results[0].value.dispose).toHaveBeenCalledTimes(1)
    })

    it('prevents switching until 2D has finished loading', async () => {
        let finish2D
        createMap2D.mockImplementationOnce(() => ({
            load: vi.fn(() => new Promise((resolve) => { finish2D = resolve })),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        const toggle = wrapper.get('[role="switch"]')
        expect(toggle.element.disabled).toBe(true)
        expect(wrapper.findComponent(Patience).exists()).toBe(true)
        expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Chargement de la carte 2D')
        expect(wrapper.get('.mapContainer').attributes('aria-busy')).toBe('true')
        await toggle.trigger('click')
        expect(createMap3D).not.toHaveBeenCalled()

        finish2D()
        await flushPromises()

        expect(toggle.element.disabled).toBe(false)
        expect(wrapper.findComponent(Patience).exists()).toBe(false)
        expect(createMap3D).not.toHaveBeenCalled()
        await toggle.trigger('click')
        await vi.waitFor(() => expect(createMap3D).toHaveBeenCalledTimes(1))
        expect(createMap3D.mock.results[0].value.load)
            .toHaveBeenCalledExactlyOnceWith(wrapper.get('#map3d').element)
        wrapper.unmount()
    })

    it('does not load 3D when unmounted while 2D is loading', async () => {
        let finish2D
        createMap2D.mockImplementationOnce(() => ({
            load: vi.fn(() => new Promise((resolve) => { finish2D = resolve })),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        wrapper.unmount()
        finish2D()
        await flushPromises()

        expect(createMap2D.mock.results[0].value.dispose).toHaveBeenCalledTimes(1)
        expect(createMap3D).not.toHaveBeenCalled()
    })

    it('keeps 2D visible and prevents duplicate loads while 3D is initializing', async () => {
        let finish3D
        createMap3D.mockImplementationOnce(() => ({
            load: vi.fn(() => new Promise((resolve) => { finish3D = resolve })),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()
        const toggle = wrapper.get('[role="switch"]')
        await toggle.trigger('click')
        await vi.waitFor(() => expect(finish3D).toBeTypeOf('function'))

        expect(toggle.element.disabled).toBe(true)
        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(wrapper.findComponent(Patience).exists()).toBe(true)
        expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Chargement de la carte 3D')
        expect(wrapper.get('[role="status"]').text()).toBe('')
        expect(wrapper.get('.mapContainer').attributes('aria-busy')).toBe('true')
        expect(wrapper.get('#map2d').classes()).not.toContain('map-hidden')
        expect(wrapper.get('#map3d').classes()).toContain('map-hidden')
        expect(wrapper.get('#map3d').attributes('inert')).toBeDefined()
        expect(createMap2D.mock.calls[0][0].isActive()).toBe(true)
        expect(createMap3D.mock.calls[0][0].isActive()).toBe(false)
        await toggle.trigger('click')
        expect(createMap3D).toHaveBeenCalledTimes(1)
        expect(createMap3D.mock.results[0].value.load).toHaveBeenCalledTimes(1)

        finish3D()
        await flushPromises()

        expect(toggle.element.disabled).toBe(false)
        expect(toggle.attributes('aria-checked')).toBe('true')
        expect(wrapper.find('[role="status"]').exists()).toBe(false)
        expect(wrapper.get('.mapContainer').attributes('aria-busy')).toBe('false')
        wrapper.unmount()
    })

    it('keeps 2D available after a 3D loading error and allows retrying', async () => {
        const cause = new Error('WebGL unavailable')
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        createMap3D.mockImplementationOnce(() => ({
            load: vi.fn().mockRejectedValueOnce(cause).mockResolvedValue(null),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()
        const toggle = wrapper.get('[role="switch"]')
        await toggle.trigger('click')
        await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))

        expect(log).toHaveBeenCalledWith('Impossible de charger la carte 3D :', cause)
        expect(wrapper.findComponent(Patience).exists()).toBe(false)
        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(toggle.element.disabled).toBe(false)
        expect(wrapper.get('#map2d').classes()).not.toContain('map-hidden')
        expect(createMap2D.mock.calls[0][0].isActive()).toBe(true)
        expect(createMap3D.mock.calls[0][0].isActive()).toBe(false)

        await toggle.trigger('click')
        await flushPromises()

        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(toggle.attributes('aria-checked')).toBe('true')
        expect(createMap3D).toHaveBeenCalledTimes(1)
        expect(createMap3D.mock.results[0].value.load).toHaveBeenCalledTimes(2)
        wrapper.unmount()
    })

    it('reports configuration errors without initializing maps or enabling the toggle', async () => {
        const cause = new Error('Configuration unavailable')
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        useGetConfig.mockRejectedValueOnce(cause)
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        expect(log).toHaveBeenCalledWith('Impossible de charger la configuration des cartes :', cause)
        expect(wrapper.get('[role="alert"]').text()).toContain('configuration')
        expect(wrapper.get('[role="switch"]').element.disabled).toBe(true)
        expect(wrapper.get('.mapContainer').attributes('aria-busy')).toBe('false')
        expect(createMap2D.mock.results[0].value.load).not.toHaveBeenCalled()
        expect(createMap2D.mock.calls[0][0].isActive()).toBe(false)
        expect(createMap3D).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('reports 2D loading errors and does not mark the maps as ready', async () => {
        const cause = new Error('2D unavailable')
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        createMap2D.mockImplementationOnce(() => ({
            load: vi.fn().mockRejectedValue(cause),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        expect(log).toHaveBeenCalledWith('Impossible de charger la carte 2D :', cause)
        expect(wrapper.get('[role="alert"]').text()).toContain('2D')
        expect(wrapper.get('[role="switch"]').element.disabled).toBe(true)
        expect(wrapper.get('.mapContainer').attributes('aria-busy')).toBe('false')
        expect(createMap2D.mock.calls[0][0].isActive()).toBe(false)
        expect(createMap3D).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('does not create 3D if unmounted during its dynamic import', async () => {
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()
        const click = wrapper.get('[role="switch"]').trigger('click')
        wrapper.unmount()
        await click
        await flushPromises()

        expect(createMap3D).not.toHaveBeenCalled()
    })

    it('disposes 3D if unmounted while its initialization is pending', async () => {
        let finish3D
        createMap3D.mockImplementationOnce(() => ({
            load: vi.fn(() => new Promise((resolve) => { finish3D = resolve })),
            dispose: vi.fn(),
        }))
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()
        await wrapper.get('[role="switch"]').trigger('click')
        await vi.waitFor(() => expect(finish3D).toBeTypeOf('function'))
        const controller3D = createMap3D.mock.results[0].value
        wrapper.unmount()
        finish3D()
        await flushPromises()

        expect(controller3D.dispose).toHaveBeenCalledTimes(1)
        expect(controller3D.load).toHaveBeenCalledTimes(1)
    })
})
