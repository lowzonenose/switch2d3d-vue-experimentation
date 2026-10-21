import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useControlsStore } from '../controls'

describe('controls store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('enables the layer switcher in both views by default', () => {
        const store = useControlsStore()
        expect(store.controls2D).toEqual(['LayerSwitcher'])
        expect(store.controls3D).toEqual(store.controls2D)
    })

    it('shares additions without duplicates or empty identifiers', () => {
        const store = useControlsStore()
        store.addControl('Scale')
        store.addControl('Scale')
        store.addControl('')
        expect(store.controls2D).toEqual(['LayerSwitcher', 'Scale'])
        expect(store.controls3D).toEqual(store.controls2D)
    })
})
