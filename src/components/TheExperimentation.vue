<script setup>
import { onMounted, ref, shallowRef, onBeforeUnmount } from 'vue'
import { createMap2D, createMap3D } from '@/maps'
import { useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'
import { useGetConfig } from '@/composables/getConfig'

defineProps({})

const map2dRef = ref(null)
const map3dRef = ref(null)
const is3D = ref(false)
const layersStore = useLayersStore()
const controlsStore = useControlsStore()
const mapStore = useMapStore()

const options = { layers: layersStore, controls: controlsStore, view: mapStore }
const map2dController = createMap2D(options)
const map3dController = createMap3D(options)
const map2dObj = shallowRef(null)
const map3dObj = shallowRef(null)
let disposed = false

onMounted(async () => {
  try {
    await useGetConfig()
    if (disposed) return

    if (map2dRef.value) {
      map2dObj.value = await map2dController.load(map2dRef.value).catch((cause) => {
        console.error('Impossible de charger la carte 2D :', cause)
      })
    }
    if (disposed) return
    if (map3dRef.value) {
      map3dObj.value = await map3dController.load(map3dRef.value).catch((cause) => {
        console.error('Impossible de charger la carte 3D :', cause)
      })
    }
  } catch (cause) {
    console.error('Impossible de charger la configuration des cartes :', cause)
  }
})

onBeforeUnmount(() => {
  disposed = true
  map3dController.dispose()
  map2dController.dispose()
})
</script>

<template>
  <div class="controlsContainer">
    <button
      type="button"
      class="mapToggle"
      role="switch"
      :aria-checked="is3D"
      aria-label="Vue 3D"
      aria-controls="map2d map3d"
      @click="is3D = !is3D"
    >
      <span :class="{ active: !is3D }" aria-hidden="true">2D</span>
      <span :class="{ active: is3D }" aria-hidden="true">3D</span>
    </button>
  </div>
  <div class="mapContainer">
    <div
      id="map2d"
      class="map2d"
      :class="{ 'map-hidden': is3D }"
      :inert="is3D ? '' : null"
      :aria-hidden="is3D"
      ref="map2dRef"
    ></div>
    <div
      id="map3d"
      class="map3d"
      :class="{ 'map-hidden': !is3D }"
      :inert="is3D ? null : ''"
      :aria-hidden="!is3D"
      ref="map3dRef"
    ></div>
  </div>
</template>

<style scoped>
.controlsContainer {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.mapToggle {
  display: inline-grid;
  grid-template-columns: repeat(2, 2.75rem);
  padding: 3px;
  border: 1px solid #666;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font: inherit;
  cursor: pointer;
}

.mapToggle span {
  padding: 0.35rem 0;
  border-radius: 3px;
  font-weight: 600;
}

.mapToggle .active {
  background: #006b57;
  color: #fff;
}

.mapToggle:focus-visible {
  outline: 2px solid #006b57;
  outline-offset: 3px;
}

.mapContainer {
  position: relative;
  width: 100%;
  height: 500px;
}

#map2d,
#map3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map2d,
.map3d {
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
  #map2d,
  #map3d {
    transition: none;
  }
}
</style>
