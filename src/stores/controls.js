import { defineStore } from 'pinia'
import { createControlsState } from '../features/state.js'

export const useControlsStore = defineStore('controls', () => createControlsState())
