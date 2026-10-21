import { defineStore } from 'pinia'
import { createViewState } from '../maps/state.js'

export const useMapStore = defineStore('map', () => createViewState())
