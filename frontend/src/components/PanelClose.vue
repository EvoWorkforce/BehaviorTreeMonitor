<template>
  <button class="panel-close" :title="`Close ${label}`" :aria-label="`Close ${label}`" @click="toggle(side)">×</button>
</template>

<script setup lang="ts">
import { usePanels } from '../composables/usePanels'
import type { PanelSide } from '../lib/panels'

defineProps<{ side: PanelSide; label: string }>()

const { toggle } = usePanels()
</script>
