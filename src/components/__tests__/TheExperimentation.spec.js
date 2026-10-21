import { beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import TheExperimentation from '../TheExperimentation.vue'
import { createMap2D, createMap3D } from '@/maps'
import { useGetConfig } from '@/composables/getConfig'

vi.mock('@/composables/getConfig', () => ({ useGetConfig: vi.fn() }))
vi.mock('@/maps', () => ({
    createMap2D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
    createMap3D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
}))

describe('TheExperimentation', () => {
    beforeEach(() => vi.clearAllMocks())

    it('toggles between mounted maps with 2D visible by default', async () => {
        const wrapper = mount(TheExperimentation, {
            global: { plugins: [createPinia()] },
        })
        await flushPromises()

        const toggle = wrapper.get('[role="switch"]')
        const map2d = wrapper.get('#map2d')
        const map3d = wrapper.get('#map3d')

        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(map2d.classes()).not.toContain('map-hidden')
        expect(map3d.classes()).toContain('map-hidden')
        expect(map3d.attributes('inert')).toBeDefined()

        await toggle.trigger('click')

        expect(toggle.attributes('aria-checked')).toBe('true')
        expect(map2d.classes()).toContain('map-hidden')
        expect(map2d.attributes('inert')).toBeDefined()
        expect(map3d.classes()).not.toContain('map-hidden')
        expect(map3d.attributes('aria-hidden')).toBe('false')
        expect(map3d.attributes('inert')).toBeUndefined()

        await toggle.trigger('click')

        expect(toggle.attributes('aria-checked')).toBe('false')
        expect(map2d.classes()).not.toContain('map-hidden')
        expect(map2d.attributes('inert')).toBeUndefined()
        expect(map3d.classes()).toContain('map-hidden')
        expect(wrapper.get('#map2d').element).toBe(map2d.element)
        expect(wrapper.get('#map3d').element).toBe(map3d.element)
        const controller2D = createMap2D.mock.results[0].value
        const controller3D = createMap3D.mock.results[0].value
        expect(controller2D.load).toHaveBeenCalledExactlyOnceWith(map2d.element)
        expect(controller3D.load).toHaveBeenCalledExactlyOnceWith(map3d.element)
        expect(createMap2D.mock.calls[0][0]).toEqual(createMap3D.mock.calls[0][0])

        wrapper.unmount()
        expect(controller2D.dispose).toHaveBeenCalledTimes(1)
        expect(controller3D.dispose).toHaveBeenCalledTimes(1)
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
        expect(createMap3D.mock.results[0].value.load).not.toHaveBeenCalled()
        expect(createMap2D.mock.results[0].value.dispose).toHaveBeenCalledTimes(1)
        expect(createMap3D.mock.results[0].value.dispose).toHaveBeenCalledTimes(1)
    })
})
