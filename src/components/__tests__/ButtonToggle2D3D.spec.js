import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ButtonToggle2D3D from '../ButtonToggle2D3D.vue/index.js'

describe('ButtonToggle2D3D', () => {
  it('defaults to 2D with accessible switch semantics', () => {
    const wrapper = mount(ButtonToggle2D3D)

    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.attributes('role')).toBe('switch')
    expect(wrapper.attributes('aria-label')).toBe('Vue 3D')
    expect(wrapper.attributes('aria-checked')).toBe('false')
    expect(wrapper.get('.active').text()).toBe('2D')
    expect(wrapper.findAll('span').every((span) => span.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('updates the parent model in both directions', async () => {
    const wrapper = mount(ButtonToggle2D3D, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': (value) => wrapper.setProps({ modelValue: value }),
      },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.attributes('aria-checked')).toBe('true')
    expect(wrapper.get('.active').text()).toBe('3D')

    await wrapper.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true], [false]])
    expect(wrapper.attributes('aria-checked')).toBe('false')
    expect(wrapper.get('.active').text()).toBe('2D')
  })

  it('reflects model changes made by the parent without emitting an update', async () => {
    const wrapper = mount(ButtonToggle2D3D, { props: { modelValue: true } })

    expect(wrapper.attributes('aria-checked')).toBe('true')
    expect(wrapper.get('.active').text()).toBe('3D')

    await wrapper.setProps({ modelValue: false })

    expect(wrapper.attributes('aria-checked')).toBe('false')
    expect(wrapper.get('.active').text()).toBe('2D')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('forwards native attributes for use with other maps', () => {
    const wrapper = mount(ButtonToggle2D3D, {
      attrs: {
        'aria-controls': 'other-map2d other-map3d',
        'aria-label': 'Autre vue 3D',
        disabled: true,
      },
    })

    expect(wrapper.attributes('aria-controls')).toBe('other-map2d other-map3d')
    expect(wrapper.attributes('aria-label')).toBe('Autre vue 3D')
    expect(wrapper.element.disabled).toBe(true)
  })
})
