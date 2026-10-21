import { defineStore } from 'pinia'
import { createLayersState } from '../maps/state.js'

export { ELEVATION_LAYER_ID } from '../maps/state.js'

export const useLayersStore = defineStore('layers', () => createLayersState())
