<script setup>
import ButtonToggle2D3D from '@/components/ButtonToggle2D3D.vue'
import Map2D from '@/components/Map2D.vue'
import Patience from '@/components/Patience.vue'
import { useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'
import { useMapMode } from '@/composables/useMapMode'

const layersStore = useLayersStore()
const controlsStore = useControlsStore()
const mapStore = useMapStore()

const {
  map2dRef,
  map3dRef,
  map3DComponent,
  options2D,
  options3D,
  is3D,
  isLoading2D,
  isLoading,
  canToggle,
  loadingError,
  setMapMode,
} = useMapMode({ layers: layersStore, controls: controlsStore, view: mapStore })
</script>

<template>
  <div class="controlsContainer">
    <ButtonToggle2D3D
      :model-value="is3D"
      :disabled="!canToggle"
      aria-controls="map2d map3d"
      @update:model-value="setMapMode"
    />
  </div>
  <p v-if="loadingError" role="alert">{{ loadingError }}</p>
  <div class="mapContainer" :aria-busy="isLoading">
    <Map2D
      id="map2d"
      class="map"
      :options="options2D"
      :class="{ 'map-hidden': is3D }"
      :inert="is3D ? '' : null"
      :aria-hidden="is3D"
      ref="map2dRef"
    />
    <component
      :is="map3DComponent"
      v-if="map3DComponent"
      id="map3d"
      class="map"
      :options="options3D"
      :class="{ 'map-hidden': !is3D }"
      :inert="is3D ? null : ''"
      :aria-hidden="!is3D"
      ref="map3dRef"
    />
    <Patience
      v-if="isLoading"
      class="map-loading"
      role="status"
      :aria-label="isLoading2D ? 'Chargement de la carte 2D' : 'Chargement de la carte 3D'"
    />
  </div>
</template>

<style scoped>
.controlsContainer {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.mapContainer {
  position: relative;
  width: 100%;
  height: 500px;
}

.map-loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transition:
    opacity 300ms ease,
    visibility 0s;
}

.map-hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition-delay: 0s, 300ms;
}

@media (prefers-reduced-motion: reduce) {
  .map {
    transition: none;
  }
}
</style>
