import { defineStore } from 'pinia'
import { createLayersState } from '../features/state.js'

export { ELEVATION_LAYER_ID } from '../features/state.js'

export const useLayersStore = defineStore('layers', () => createLayersState())
