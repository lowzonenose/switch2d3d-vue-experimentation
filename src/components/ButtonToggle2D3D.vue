<script setup>
const is3D = defineModel({ type: Boolean, default: false })
</script>

<template>
  <button
    type="button"
    class="mapToggle"
    role="switch"
    :aria-checked="is3D"
    aria-label="Vue 3D"
    @click="is3D = !is3D"
  >
    <span :class="{ active: !is3D }" aria-hidden="true">2D</span>
    <span :class="{ active: is3D }" aria-hidden="true">3D</span>
  </button>
</template>

<style scoped>
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
</style>
