<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { createMap3D } from '../maps/createMap3D.js'

const props = defineProps({
  options: { type: Object, required: true },
})

const target = ref(null)
const controller = createMap3D(props.options)

function load() {
  return controller.load(target.value)
}

onBeforeUnmount(() => controller.dispose())

defineExpose({ load })
</script>

<template>
  <div ref="target" class="map3d"></div>
</template>
