<template>
  <span v-if="!isContainer(value)" class="bb-scalar" :class="{ 'bb-null': value === null }">
    <template v-if="isBytes(value)">bytes({{ value.__bytes.length / 2 }}) {{ value.__bytes.slice(0, 32) }}</template>
    <template v-else-if="value === null">{{ nullText }}</template>
    <template v-else>{{ formatScalar(value) }}</template>
  </span>
  <details v-else class="bb-tree" :open="depth < 1">
    <summary>{{ summaryText }}</summary>
    <div v-for="[k, child] in entries" :key="k" class="bb-child">
      <span class="bb-key">{{ k }}</span>
      <BlackboardValue :value="child" :depth="depth + 1" :null-text="nullText" />
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatScalar, isBytes, isContainer } from '@/lib/format'

const props = withDefaults(defineProps<{ value: unknown; depth?: number; nullText?: string }>(), {
  depth: 0,
  nullText: 'null',
})

const summaryText = computed(() => {
  const v = props.value
  if (Array.isArray(v)) return '[' + v.length + ']'
  return isContainer(v) ? '{' + Object.keys(v).length + '}' : ''
})
const entries = computed(() => (isContainer(props.value) ? Object.entries(props.value) : []))
</script>
