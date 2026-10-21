import { defineStore } from 'pinia'
import { createControlsState } from '../maps/state.js'

export const useControlsStore = defineStore('controls', () => createControlsState())
