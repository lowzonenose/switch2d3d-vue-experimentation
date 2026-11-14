import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Map3D from '../Map3D.vue'
import { createMap3D } from '../../features/createMap3D.js'

vi.mock('../../features/createMap3D.js', () => ({
  createMap3D: vi.fn(() => ({
    load: vi.fn(async () => ({ id: 'globe' })),
    dispose: vi.fn(),
  })),
}))

describe('Map3D', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initializes independent instances with host options and disposes them on unmount', async () => {
    const firstOptions = reactive({ view: { coordinates: { longitude: 2, latitude: 48 }, zoom: 10 } })
    const secondOptions = reactive({ view: { coordinates: { longitude: 4, latitude: 45 }, zoom: 8 } })
    const first = mount(Map3D, { props: { options: firstOptions } })
    const second = mount(Map3D, { props: { options: secondOptions } })
    const firstController = createMap3D.mock.results[0].value
    const secondController = createMap3D.mock.results[1].value
    await vi.waitFor(() => expect(first.emitted('ready')).toHaveLength(1))

    expect(createMap3D.mock.calls[0][0]).toBe(firstOptions)
    expect(createMap3D.mock.calls[1][0]).toBe(secondOptions)
    expect(firstController.load).toHaveBeenCalledExactlyOnceWith(first.element)
    expect(secondController.load).toHaveBeenCalledExactlyOnceWith(second.element)
    first.unmount()
    expect(firstController.dispose).toHaveBeenCalledTimes(1)
    expect(secondController.dispose).not.toHaveBeenCalled()
    second.unmount()
  })

  it('passes through the host-owned reactive view, layers and controls', () => {
    const options = reactive({
      view: { coordinates: { longitude: 2, latitude: 48 }, zoom: 10 },
      layers: { layerDescriptors: [{ id: 'plan', opacity: 1 }] },
      controls: { controls3D: ['Scale'] },
    })
    const wrapper = mount(Map3D, { props: { options, autoLoad: false } })
    const received = createMap3D.mock.calls[0][0]
    expect(received).toBe(options)

    options.view.zoom = 12
    options.layers.layerDescriptors[0].opacity = 0.4
    options.controls.controls3D.push('MousePosition')
    expect(received.view.zoom).toBe(12)
    expect(received.layers.layerDescriptors[0].opacity).toBe(0.4)
    expect(received.controls.controls3D).toEqual(['Scale', 'MousePosition'])
    wrapper.unmount()
  })

  it('emits and rejects manual loading failures', async () => {
    const wrapper = mount(Map3D, { props: { options: {}, autoLoad: false } })
    const failure = new Error('globe indisponible')
    createMap3D.mock.results[0].value.load.mockRejectedValueOnce(failure)

    await expect(wrapper.vm.load()).rejects.toBe(failure)
    expect(wrapper.emitted('error')[0]).toEqual([failure])
    wrapper.unmount()
  })

  it('does not emit ready after unmount while loading is pending', async () => {
    let finish
    const wrapper = mount(Map3D, { props: { options: {}, autoLoad: false } })
    createMap3D.mock.results[0].value.load.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const loading = wrapper.vm.load()
    wrapper.unmount()
    finish({ id: 'globe' })
    await loading
    expect(wrapper.emitted('ready')).toBeUndefined()
  })
})
