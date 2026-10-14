<template>
  <span class="source-badge" :class="view" :title="label">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useViewStore } from '../stores/viewStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useFileSourceStore } from '../stores/fileSource'
import { sourceLabel } from '../lib/treeFiles'

const viewStore = useViewStore()
const conn = useConnectionStore()
const src = useFileSourceStore()

const view = computed(() => viewStore.activeView)
const label = computed(() => sourceLabel(view.value, conn, src.current ?? undefined))
</script>
