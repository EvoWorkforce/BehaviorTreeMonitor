<template>
  <g
    class="node-group"
    :class="[statusClass, typeClass, { 'is-subtree': props.node.isSubtreeContainer, 'is-match': props.highlighted }]"
    :transform="`translate(${props.node.x}, ${props.node.y})`"
    @mouseenter="$emit('mouseenter', $event, props.node)"
    @mouseleave="$emit('mouseleave')"
  >
    <!-- Node background -->
    <rect class="node-box" :width="props.node.width" :height="height" rx="4" />

    <!-- Icon (left-aligned) -->
    <component :is="nodeIcon" class="node-icon" x="6" y="8" width="12" height="12" />

    <!-- Name (centred in the area right of the icon) -->
    <text class="node-title" :x="(22 + props.node.width - (props.node.isSubtreeContainer ? 20 : 0)) / 2" y="15" text-anchor="middle">{{ props.node.name }}</text>

    <!-- Subtree expand/collapse button -->
    <g v-if="props.node.isSubtreeContainer" class="subtree-toggle" @click.stop="$emit('toggle-subtree', props.node)">
      <rect
        class="toggle-btn-bg"
        :x="props.node.width - 20"
        y="6"
        width="16"
        height="16"
        rx="3"
      />
      <line
        class="toggle-btn-icon-line"
        :x1="props.node.width - 16"
        y1="14"
        :x2="props.node.width - 8"
        y2="14"
      />
      <line
        v-if="!props.node.expanded"
        class="toggle-btn-icon-line"
        :x1="props.node.width - 12"
        y1="10"
        :x2="props.node.width - 12"
        y2="18"
      />
    </g>

    <!-- Port list -->
    <g class="ports" :transform="`translate(0, ${store.NODE_BASE_HEIGHT})`">
      <g
        v-for="(port, index) in ports"
        :key="port.name"
        class="port-group"
        :transform="`translate(0, ${index * store.PORT_HEIGHT})`"
      >
        <line class="port-divider" x1="3" :x2="props.node.width - 3" y1="0" y2="0" />
        <text :class="port.isOutput ? 'port-out' : 'port-in'" x="7" y="13" font-size="8">
          {{ port.isOutput ? 'OUT' : 'IN' }}:
        </text>
        <text class="port-label" x="30" y="13">{{ port.name }}</text>
        <rect
          class="port-value-bg"
          :x="props.node.width - maxValueWidth - 8"
          y="2"
          :width="maxValueWidth + 4"
          :height="store.PORT_HEIGHT - 4"
          rx="2"
        />
        <text class="port-value" :x="props.node.width - maxValueWidth - 6" y="13" text-anchor="start">
          {{ port.value }}
        </text>
        <text
          v-if="live(port) !== null"
          class="port-live"
          :class="{ null: live(port)!.isNull }"
          :x="props.node.width + 6"
          y="13"
        >
          {{ live(port)!.text }}
          <title v-if="live(port)!.hint">{{ live(port)!.hint }}</title>
        </text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { TreeNode, NodePort } from '@/types'
import IconRoot from './icons/IconRoot.vue'
import IconSequence from './icons/IconSequence.vue'
import IconFallback from './icons/IconFallback.vue'
import IconParallel from './icons/IconParallel.vue'
import IconDecorator from './icons/IconDecorator.vue'
import IconAction from './icons/IconAction.vue'
import IconCondition from './icons/IconCondition.vue'
import IconSubtree from './icons/IconSubtree.vue'
import { useBlackboardStore } from '@/stores/blackboardStore'
import { describeNull, resolvePortValue } from '@/lib/blackboard'
import { summarize } from '@/lib/format'
import { useTreeStore, getNodePorts, getNodeHeight, measureTextWidth } from '@/stores/treeStore'

const props = defineProps<{ node: TreeNode; highlighted?: boolean }>()
defineEmits<{
  mouseenter: [event: MouseEvent, node: TreeNode]
  mouseleave: []
  'toggle-subtree': [node: TreeNode]
}>()

const store = useTreeStore()
const bb = useBlackboardStore()

/** The blackboard value behind a `{key}` port, or null when the port is a literal or unknown. */
function live(port: NodePort): { text: string; isNull: boolean; hint?: string } | null {
  if (!store.ownUids.has(props.node.uid)) return null
  const v = resolvePortValue(port.value, bb.current)
  if (v === undefined) return null
  if (v === null) {
    const key = port.value.trim().slice(1, -1)
    return { text: 'null', isNull: true, hint: describeNull(key, bb.portTypes) }
  }
  return { text: summarize(v), isNull: false }
}

const height = computed(() => getNodeHeight(props.node))
const ports = computed<NodePort[]>(() => getNodePorts(props.node))

const status = computed(() => store.nodeStatuses[props.node.uid] ?? 'IDLE')

const statusClass = computed(() => {
  const s = status.value.toLowerCase()
  if (s.includes('running')) return 'status-running'
  if (s.includes('success')) return 'status-success'
  if (s.includes('failure')) return 'status-failure'
  return 'status-idle'
})

const typeClass = computed(() => `type-${props.node.type}`)

const ICONS: Record<string, Component> = {
  root: IconRoot,
  sequence: IconSequence,
  fallback: IconFallback,
  parallel: IconParallel,
  decorator: IconDecorator,
  action: IconAction,
  condition: IconCondition,
  subtree: IconSubtree,
}

const nodeIcon = computed(() => ICONS[props.node.type] ?? IconAction)

const maxValueWidth = computed(() => {
  let max = 20
  for (const port of ports.value) {
    const w = measureTextWidth(String(port.value || ''), 6) + 8
    if (w > max) max = w
  }
  return max
})
</script>

<style scoped>
.port-in {
  fill: var(--port-in);
  font-weight: 600;
}
.port-out {
  fill: var(--port-out);
  font-weight: 600;
}
.port-value-bg {
  fill: var(--port-value-bg);
}
.port-divider {
  stroke: var(--border-color);
  stroke-width: 0.5;
}
.is-subtree .node-box {
  stroke-dasharray: 4 2;
}
/* Control node name and icon */
.type-sequence .node-title,
.type-fallback .node-title,
.type-parallel .node-title {
  fill: var(--node-control);
}
.type-sequence .node-icon,
.type-fallback .node-icon,
.type-parallel .node-icon {
  color: var(--node-control);
}
/* Decorator node name and icon */
.type-decorator .node-title {
  fill: var(--node-decorator);
}
.type-decorator .node-icon {
  color: var(--node-decorator);
}
/* Subtree toggle button */
.subtree-toggle {
  cursor: pointer;
}
.toggle-btn-bg {
  fill: var(--bg-tertiary);
  stroke: var(--border-light);
  stroke-width: 1;
  transition: all 0.2s;
}
.subtree-toggle:hover .toggle-btn-bg {
  fill: var(--connection-color);
  stroke: var(--connection-color);
}
.toggle-btn-icon-line {
  stroke: var(--text-primary);
  stroke-width: 1.8;
  stroke-linecap: round;
  pointer-events: none;
}
.subtree-toggle:hover .toggle-btn-icon-line {
  stroke: var(--bg-primary);
}
</style>
