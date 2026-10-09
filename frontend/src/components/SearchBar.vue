<template>
  <div class="search-bar">
    <input
      ref="inputRef"
      v-model="query"
      class="search-input"
      type="text"
      placeholder="Search nodes ( / )"
      aria-label="Search nodes"
      @keydown.enter.prevent="next"
      @keydown.esc="onEscape"
    />
    <span v-if="query.trim()" class="search-count">{{ matches.length ? index + 1 : 0 }}/{{ matches.length }}</span>
    <label class="follow-toggle" title="Pan to the deepest running node">
      <input type="checkbox" :checked="follow" @change="emit('update:follow', ($event.target as HTMLInputElement).checked)" />
      Follow
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { findDeepestRunning, matchNodes } from '@/lib/search'
import { shouldHandleShortcut } from '@/lib/panels'
import type { TreeNode } from '@/types'

const props = defineProps<{
  root: TreeNode | null
  statuses: Record<string, string>
  follow: boolean
}>()
const emit = defineEmits<{
  (e: 'update:follow', value: boolean): void
  (e: 'update:matchUids', value: Set<string>): void
  (e: 'pan-to', node: TreeNode): void
}>()

const query = ref('')
const index = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const matches = computed(() => matchNodes(props.root, query.value))

watch(matches, list => {
  index.value = 0
  emit('update:matchUids', new Set(list.map(n => n.uid)))
})

function next() {
  if (!matches.value.length) return
  index.value = (index.value + 1) % matches.value.length
  emit('pan-to', matches.value[index.value])
}

function onEscape() {
  query.value = ''
  inputRef.value?.blur()
}

// Follow: on each status message, pan to the deepest running node.
watch(
  () => props.statuses,
  () => {
    if (!props.follow) return
    const node = findDeepestRunning(props.root, props.statuses)
    if (node) emit('pan-to', node)
  },
  { deep: true },
)

function onKey(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  if (!shouldHandleShortcut(e.target)) return
  e.preventDefault()
  inputRef.value?.focus()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
