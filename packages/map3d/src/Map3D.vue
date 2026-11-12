<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMap3D } from './useMap3D.js'

const props = defineProps({
  options: { type: Object, required: true },
  autoLoad: { type: Boolean, default: true },
})
const emit = defineEmits(['ready', 'error'])
const target = ref(null)
let unmounted = false
onBeforeUnmount(() => { unmounted = true })
const controller = useMap3D(props.options)

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

onMounted(() => {
  if (props.autoLoad) load().catch((cause) => console.error('Impossible de charger la carte 3D :', cause))
})

defineExpose({ load, dispose: controller.dispose })
</script>

<template>
  <div ref="target" class="map3d"></div>
</template>
