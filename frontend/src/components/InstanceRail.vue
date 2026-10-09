<template>
  <aside class="instance-rail" aria-label="Instances">
    <div class="rail-title">Instances</div>
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
        <span class="rail-dot" :class="statusClass(row.node)"></span>
        <span class="rail-label">{{ label(row.node) }}</span>
      </li>
    </ul>
    <div v-else class="rail-empty">No tree loaded</div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { InstanceNode } from '@/lib/instances'

const props = defineProps<{
  root: InstanceNode | null
  selectedPath: string
  statuses: Record<string, string>
}>()
const emit = defineEmits<{ (e: 'select', path: string): void }>()

const rows = computed(() => {
  const out: { node: InstanceNode; depth: number }[] = []
  const walk = (n: InstanceNode, depth: number) => {
    out.push({ node: n, depth })
    n.children.forEach(c => walk(c, depth + 1))
  }
  if (props.root) walk(props.root, 0)
  return out
})

function label(n: InstanceNode): string {
  if (!n.path) return n.treeId
  const last = n.path.split('/').pop() ?? n.path
  return last
}

function statusClass(n: InstanceNode): string {
  if (!n.subtreeUid) return 'idle'
  const s = (props.statuses[n.subtreeUid] ?? 'IDLE').toLowerCase()
  if (s.includes('running')) return 'running'
  if (s.includes('success')) return 'success'
  if (s.includes('failure')) return 'failure'
  return 'idle'
}
</script>
