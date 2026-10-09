<template>
  <div class="zoom-controls">
    <button class="btn" title="Zoom in" @click="emit('zoom-in')"><IconPlus /></button>
    <button class="btn" title="Zoom out" @click="emit('zoom-out')"><IconMinus /></button>
    <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
    <button class="btn" title="Fit" @click="emit('fit')"><IconFit /></button>
    <button class="btn" title="Reset" @click="emit('reset')"><IconReset /></button>
    <span class="zoom-divider"></span>
    <button class="btn" :title="horizontal ? 'Switch to vertical layout' : 'Switch to horizontal layout'" @click="emit('toggle-layout')">
      <IconLayoutH v-if="horizontal" />
      <IconLayoutV v-else />
    </button>
  </div>
</template>

<script setup lang="ts">
import IconPlus from './icons/IconPlus.vue'
import IconMinus from './icons/IconMinus.vue'
import IconFit from './icons/IconFit.vue'
import IconReset from './icons/IconReset.vue'
import IconLayoutH from './icons/IconLayoutH.vue'
import IconLayoutV from './icons/IconLayoutV.vue'

defineProps<{ zoom: number; horizontal: boolean }>()
const emit = defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'fit'): void
  (e: 'reset'): void
  (e: 'toggle-layout'): void
}>()
</script>
