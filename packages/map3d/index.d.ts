import type { DefineComponent } from 'vue'

export interface Map3DCoordinates {
  longitude: number
  latitude: number
}
export interface Map3DView {
  coordinates: Map3DCoordinates
  zoom: number
  setView(coordinates: Map3DCoordinates, zoom: number): void
}
export interface Map3DLayerInput {
  id: string
  type?: string
  visible?: boolean
  opacity?: number
  order?: number
  source?: { layer?: string; [key: string]: unknown }
}
export interface Map3DLayerDescriptor extends Map3DLayerInput {
  type: string
  visible: boolean
  opacity: number
  order: number
  source: { layer: string; [key: string]: unknown }
}
export interface Map3DLayers {
  descriptors3D?: readonly Map3DLayerDescriptor[]
  layers2D: readonly string[]
  layers3D: readonly string[]
  addLayer(layer: string | Map3DLayerInput): void
  removeLayer(id: string): void
  updateLayer?(id: string, changes: Partial<Map3DLayerInput>): void
}
export interface Map3DControls {
  controls3D: readonly string[]
}

export interface Map3DOptions {
  view: Map3DView
  layers: Map3DLayers
  controls: Map3DControls
  elevationLayerId?: string | null
  globeOptions?: Record<string, unknown>
  controlTypes?: Record<string, new (options: Record<string, never>) => unknown>
  attribution?: { name: string; url: string }[]
  isActive?: () => boolean
}
export interface Map3DController {
  load(target: HTMLElement): Promise<unknown | undefined>
  dispose(): void
}
export declare function createMap3D(options: Map3DOptions): Map3DController

export interface Map3DProps {
  options: Map3DOptions
  autoLoad?: boolean
}
export interface Map3DExposed {
  load(): Promise<unknown | undefined>
  dispose(): void
}
export type Map3DEmits = {
  ready: (globe: unknown) => boolean
  error: (cause: unknown) => boolean
}
export declare const Map3D: DefineComponent<
  Map3DProps,
  Map3DExposed,
  {},
  {},
  {},
  {},
  {},
  Map3DEmits
>
export declare function useMap3D(options: Map3DOptions): Map3DController
