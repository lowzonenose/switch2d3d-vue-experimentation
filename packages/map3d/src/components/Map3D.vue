<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMap3D } from '../composables/useMap3D.js'

// Composant Vue pour intégrer une carte 3D avec gestion automatique du cycle de vie.

const props = defineProps({
  options: { type: Object, required: true },
  adapter: { type: Function, default: null },
  autoLoad: { type: Boolean, default: true },
})

// Émet les événements 'ready' et 'error' lors du chargement de la carte 3D.
const emit = defineEmits(['ready', 'error'])

// Référence vers l'élément DOM qui contiendra la carte 3D.
const target = ref(null)

// Contrôleur de la carte 3D créé à partir des options fournies.
const controller = useMap3D(props.adapter ? props.adapter(props.options) : props.options)

// Indique si le composant a été démonté pour éviter d'émettre
// des événements après le démontage.
let unmounted = false

// Fonction pour charger la carte 3D dans l'élément DOM cible.
async function load() {
  try {
    const globe = await controller.load(target.value)
    if (globe && !unmounted) emit('ready', globe)
    return globe
  } catch (cause) {
    if (!unmounted) emit('error', cause)
    throw cause
  }
}

// Expose les fonctions load et dispose pour permettre un contrôle externe du composant.
defineExpose({ load, dispose: controller.dispose })

onBeforeUnmount(() => {
  unmounted = true
})
onMounted(() => {
  // Charge automatiquement la carte 3D si la propriété autoLoad est activée.
  if (props.autoLoad)
    load().catch((cause) => console.error('Impossible de charger la carte 3D :', cause))
})
</script>

<template>
  <div ref="target" class="map3d"></div>
</template>
