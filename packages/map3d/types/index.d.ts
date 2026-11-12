import type { DefineComponent } from 'vue'
import type { Map3DController, Map3DOptions } from './core.js'

export * from './core.js'

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
