<template>
  <aside class="instance-rail" aria-label="Instances">
    <div class="rail-title">Instances <PanelClose side="left" label="instances" /></div>
    <div v-if="depth > 1" class="rail-levels" role="group" aria-label="Show levels">
      <span class="rail-levels-label">Levels</span>
      <button
        v-for="n in depth"
        :key="n"
        type="button"
        class="rail-level"
        :class="{ active: activeLevel === n }"
        :title="n === depth ? 'Show all levels' : `Show ${n} level${n > 1 ? 's' : ''}`"
        @click="showLevels(n)"
      >{{ n === depth ? 'All' : n }}</button>
    </div>
    <ul v-if="rows.length" class="rail-list">
      <li
        v-for="row in rows"
        :key="row.node.path || '__root__'"
        class="rail-row"
        :class="{ selected: row.node.path === selectedPath }"
        :style="{ paddingLeft: 8 + row.depth * 14 + 'px' }"
        :title="row.node.path || row.node.treeId"
        @click="emit('select', row.node.path)"
      >
        <button
          v-if="row.node.children.length"
          type="button"
          class="rail-chevron"
          :class="{ collapsed: collapsed.has(keyOf(row.node)) }"
          :aria-expanded="!collapsed.has(keyOf(row.node))"
          :title="collapsed.has(keyOf(row.node)) ? 'Expand' : 'Collapse'"
          @click.stop="toggle(row.node)"
        >▾</button>
        <span v-else class="rail-chevron-gap"></span>
        <span class="rail-dot" :class="statusClass(row.node)"></span>
        <span class="rail-label">{{ label(row.node) }}</span>
      </li>
    </ul>
    <div v-else class="rail-empty">No tree loaded</div>
  </aside>
</template>

<script setup lang="ts">
import { statusKind } from '@/lib/statusKind'
import PanelClose from './PanelClose.vue'
import { computed, ref, watch } from 'vue'
import { ROOT_KEY, collapsedToLevels, maxDepth, visibleRows, type InstanceNode } from '@/lib/instances'

const props = defineProps<{
  root: InstanceNode | null
  selectedPath: string
  statuses: Record<string, string>
}>()
const emit = defineEmits<{ (e: 'select', path: string): void }>()

const collapsed = ref<Set<string>>(new Set())
const rows = computed(() => visibleRows(props.root, collapsed.value))
const depth = computed(() => maxDepth(props.root))

const keyOf = (n: InstanceNode): string => n.path || ROOT_KEY

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every(k => b.has(k))

/** The level button that matches the current folds; 0 when none does. */
const activeLevel = computed(() => {
  for (let n = 1; n <= depth.value; n++) {
    if (sameSet(collapsed.value, collapsedToLevels(props.root, n))) return n
  }
  return 0
})

function toggle(n: InstanceNode) {
  const next = new Set(collapsed.value)
  if (!next.delete(keyOf(n))) next.add(keyOf(n))
  collapsed.value = next
}

function showLevels(n: number) {
  collapsed.value = collapsedToLevels(props.root, n)
}

// A new tree keeps the folds of instances that still exist.
watch(() => props.root, root => {
  const live = new Set<string>()
  const walk = (n: InstanceNode) => { live.add(keyOf(n)); n.children.forEach(walk) }
  if (root) walk(root)
  collapsed.value = new Set([...collapsed.value].filter(k => live.has(k)))
})

function label(n: InstanceNode): string {
  if (!n.path) return n.treeId
  const last = n.path.split('/').pop() ?? n.path
  return last
}

function statusClass(n: InstanceNode): string {
  if (!n.subtreeUid) return 'idle'
  return statusKind(props.statuses[n.subtreeUid])
}
</script>
