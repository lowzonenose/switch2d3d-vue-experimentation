<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import '@portail/map3d/style.css'
import { Map3D } from '@portail/map3d'
import { loadCatalog } from './catalog.js'
import { createDemoMapState } from './mapState.js'

const PLAN_LAYER_ID = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'

let unmounted = false

// Comme dans l'application experimentale, les remontees de navigation du globe
// vers `view.setView` ne sont autorisees qu'une fois le globe pret : sans ce
// predicat, les evenements emis pendant l'initialisation entrent en boucle
// avec la synchronisation de la vue.
const globeReady = ref(false)
const options = {
  ...createDemoMapState(),
  isActive: () => !unmounted && globeReady.value,
}
const { view, layers } = options
const ready = ref(false)
const error = ref(null)

const hasPlan = computed(() => layers.layers3D.includes(PLAN_LAYER_ID))

function togglePlan() {
  if (hasPlan.value) layers.removeLayer(PLAN_LAYER_ID)
  else layers.addLayer(PLAN_LAYER_ID)
}

function goToParis() {
  view.setView({ longitude: 2.3465, latitude: 48.88 }, 12)
}

onBeforeUnmount(() => {
  unmounted = true
})
onMounted(async () => {
  try {
    await loadCatalog()
    if (!unmounted) ready.value = true
  } catch (cause) {
    if (!unmounted) error.value = cause
  }
})
</script>

<template>
  <header>
    <h1>Demo @portail/map3d</h1>
    <p class="status">
      {{ view.coordinates.longitude.toFixed(4) }}, {{ view.coordinates.latitude.toFixed(4) }} —
      zoom {{ view.zoom.toFixed(1) }}
    </p>
    <button type="button" :disabled="!ready" @click="togglePlan">
      {{ hasPlan ? 'Retirer' : 'Ajouter' }} le plan IGN
    </button>
    <button type="button" :disabled="!ready" @click="goToParis">Recentrer sur Paris</button>
  </header>
  <main>
    <p v-if="error" role="alert">Impossible de charger la carte : {{ error.message }}</p>
    <p v-else-if="!ready" class="status">Chargement du catalogue…</p>
    <Map3D
      v-else
      class="globe"
      :options="options"
      @ready="globeReady = true"
      @error="error = $event"
    />
  </main>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
}

#app {
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
}

header h1 {
  font-size: 1.1rem;
  margin: 0;
}

.status {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

main {
  flex: 1;
  min-height: 0;
}

.globe {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Le canvas est un element inline : en flux, son espace de ligne deborde du
   conteneur et fait osciller les scrollbars et le ResizeObserver du globe. */
.globe canvas {
  display: block;
}
</style>
