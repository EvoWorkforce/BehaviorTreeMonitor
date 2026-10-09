<template>
  <div class="status-bar">
    <div v-for="s in STATUSES" :key="s" class="stat-item">
      <span class="stat-dot" :class="s"></span>
      <span class="stat-count">{{ stats[s] }}</span>
      <span class="stat-label">{{ s.toUpperCase() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const STATUSES = ['idle', 'running', 'success', 'failure'] as const

defineProps<{
  stats: Record<(typeof STATUSES)[number], number>
}>()
</script>
