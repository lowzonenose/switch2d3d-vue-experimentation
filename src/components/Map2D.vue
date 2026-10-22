<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { createMap2D } from '../maps'

const props = defineProps({
  options: { type: Object, required: true },
})

const target = ref(null)
const controller = createMap2D(props.options)

function load() {
  return controller.load(target.value)
}

onBeforeUnmount(() => controller.dispose())

defineExpose({ load })
</script>

<template>
  <div ref="target" class="map2d"></div>
</template>
