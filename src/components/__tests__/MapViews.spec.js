import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Map2D from '../Map2D.vue'
import Map3D from '../Map3D.vue'
import { createMap2D, createMap3D } from '@/maps'

vi.mock('@/maps', () => ({
  createMap2D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
  createMap3D: vi.fn(() => ({ load: vi.fn(async () => null), dispose: vi.fn() })),
}))

describe.each([
  ['Map2D', Map2D, createMap2D, 'map2d'],
  ['Map3D', Map3D, createMap3D, 'map3d'],
])('%s', (_name, component, createController, className) => {
  beforeEach(() => vi.clearAllMocks())

  it('loads into its own element only when requested and disposes on unmount', async () => {
    const options = { layers: {}, controls: {}, view: {} }
    const wrapper = mount(component, { props: { options } })
    const controller = createController.mock.results[0].value

    expect(createController).toHaveBeenCalledExactlyOnceWith(options)
    expect(wrapper.classes()).toContain(className)
    expect(controller.load).not.toHaveBeenCalled()

    await wrapper.vm.load()

    expect(controller.load).toHaveBeenCalledExactlyOnceWith(wrapper.element)
    wrapper.unmount()
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('forwards visibility and accessibility attributes to the map element', () => {
    const wrapper = mount(component, {
      props: { options: {} },
      attrs: { id: 'custom-map', class: 'map-hidden', inert: '', 'aria-hidden': 'true' },
    })

    expect(wrapper.attributes('id')).toBe('custom-map')
    expect(wrapper.classes()).toContain('map-hidden')
    expect(wrapper.attributes('inert')).toBeDefined()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('propagates loading errors to the parent', async () => {
    const wrapper = mount(component, { props: { options: {} } })
    const controller = createController.mock.results[0].value
    const cause = new Error('Map loading failed')
    controller.load.mockRejectedValueOnce(cause)

    await expect(wrapper.vm.load()).rejects.toBe(cause)

    wrapper.unmount()
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })
})
