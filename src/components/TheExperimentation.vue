<script setup>
import { onMounted, ref } from 'vue'
import ButtonToggle2D3D from '@/components/ButtonToggle2D3D.vue'
import Map2D from '@/components/Map2D.vue'
import Map3D from '@/components/Map3D.vue'
import { useLayersStore } from '@/stores/layers'
import { useControlsStore } from '@/stores/controls'
import { useMapStore } from '@/stores/map'
import { useGetConfig } from '@/composables/getConfig'

const map2dRef = ref(null)
const map3dRef = ref(null)
const is3D = ref(false)
const layersStore = useLayersStore()
const controlsStore = useControlsStore()
const mapStore = useMapStore()

const options = { layers: layersStore, controls: controlsStore, view: mapStore }

onMounted(async () => {
  try {
    await useGetConfig()

    if (map2dRef.value) {
      await map2dRef.value.load().catch((cause) => {
        console.error('Impossible de charger la carte 2D :', cause)
      })
    }

    if (map3dRef.value) {
      await map3dRef.value.load().catch((cause) => {
        console.error('Impossible de charger la carte 3D :', cause)
      })
    }
  } catch (cause) {
    console.error('Impossible de charger la configuration des cartes :', cause)
  }
})
</script>

<template>
  <div class="controlsContainer">
    <ButtonToggle2D3D v-model="is3D" aria-controls="map2d map3d" />
  </div>
  <div class="mapContainer">
    <Map2D
      id="map2d"
      class="map"
      :options="options"
      :class="{ 'map-hidden': is3D }"
      :inert="is3D ? '' : null"
      :aria-hidden="is3D"
      ref="map2dRef"
    />
    <Map3D
      id="map3d"
      class="map"
      :options="options"
      :class="{ 'map-hidden': !is3D }"
      :inert="is3D ? null : ''"
      :aria-hidden="!is3D"
      ref="map3dRef"
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
