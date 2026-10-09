<template>
  <nav class="breadcrumb" aria-label="Instance path">
    <button class="crumb" :class="{ current: !path }" @click="emit('select', '')">{{ rootLabel }}</button>
    <template v-for="seg in segments" :key="seg.path">
      <span class="crumb-sep">/</span>
      <button class="crumb" :class="{ current: seg.path === path }" @click="emit('select', seg.path)">
        {{ seg.label }}
      </button>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { breadcrumb } from '@/lib/instances'

const props = defineProps<{ path: string; rootLabel: string }>()
const emit = defineEmits<{ (e: 'select', path: string): void }>()
const segments = computed(() => breadcrumb(props.path))
</script>
