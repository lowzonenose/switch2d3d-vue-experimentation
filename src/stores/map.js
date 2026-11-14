import { defineStore } from 'pinia'
import { createViewState } from '../features/state.js'

export const useMapStore = defineStore('map', () => createViewState())
