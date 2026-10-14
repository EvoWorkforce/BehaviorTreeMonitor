<template>
  <div class="app">
    <Toolbar :connection-error="connectionError" :send="wsSend" />

    <!-- Main content -->
    <main class="main-content">
      <InstanceRail
        v-if="panels.leftOpen"
        :style="{ width: panels.leftWidth + 'px' }"
        :root="store.instances"
        :selected-path="store.selectedPath"
        :statuses="store.nodeStatuses"
        @select="onSelectInstance"
      />
      <div ref="containerRef" class="canvas-container">
        <div class="canvas-header">
          <Breadcrumb
            v-if="store.instances"
            :path="store.selectedPath"
            :root-label="store.instances.treeId"
            @select="onSelectInstance"
          />
          <StatusCounts v-if="conn.connected" :stats="store.stats" />
          <SearchBar v-model:follow="follow" :root="store.treeData" :statuses="store.nodeStatuses" @update:match-uids="matchUids = $event" @pan-to="panToNode" />
        </div>
        <div class="canvas-bg"></div>

        <!-- SVG canvas -->
        <svg
          ref="canvasRef"
          class="tree-canvas"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @wheel.prevent="onWheel"
        >
          <g :transform="`translate(${panX}, ${panY}) scale(${zoom})`">
            <!-- Connection lines -->
            <g class="connections">
              <template v-for="conn in connections" :key="conn.id">
                <path :d="conn.path" class="connection-line-glow" />
                <path :d="conn.path" class="connection-line" />
              </template>
            </g>
            <!-- Nodes -->
            <g class="nodes">
              <BehaviorNode
                v-for="node in visibleNodes"
                :key="node.uid"
                :node="node"
                :highlighted="matchUids.has(node.uid)"
                @mouseenter="showTooltip"
                @mouseleave="hideTooltip"
                @toggle-subtree="onToggleSubtree"
                @open-subtree="onOpenSubtree"
              />
            </g>
          </g>
        </svg>

        <ZoomControls
          :zoom="zoom"
          :horizontal="store.horizontal"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @fit="zoomFit"
          @reset="zoomReset"
          @toggle-layout="onToggleLayout"
        />

        <!-- Empty state -->
        <div v-if="!conn.connected || !store.treeData" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L12 8M12 8L6 14M12 8L18 14M6 14L6 21M18 14L18 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="12" cy="3" r="2" fill="currentColor" />
            <circle cx="6" cy="14" r="2" fill="currentColor" />
            <circle cx="18" cy="14" r="2" fill="currentColor" />
          </svg>
          <h3>{{ conn.connected ? 'Waiting for behavior tree data...' : 'Not connected to a BT server' }}</h3>
          <p>{{ conn.connected ? 'Fetching the tree structure' : 'Enter the server address and click Connect' }}</p>
        </div>

        <!-- Tooltip -->
        <div v-if="tooltip.visible" class="tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
          <div class="tooltip-title">{{ tooltip.node?.name }}</div>
          <div class="tooltip-type">{{ tooltip.node?.tag }}</div>
          <div v-for="(value, key) in tooltipAttrs" :key="key" class="tooltip-attr">
            <span class="tooltip-attr-name">{{ key }}:</span>
            <span class="tooltip-attr-value">{{ value }}</span>
          </div>
        </div>
      </div>
      <BlackboardRail v-if="panels.rightOpen" :style="{ width: panels.rightWidth + 'px' }" />
    </main>
    <Timeline v-if="panels.bottomOpen" :style="{ height: panels.bottomHeight + 'px' }" :send="wsSend" @select-node="onSelectTimelineNode" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import BehaviorNode from './components/BehaviorNode.vue'
import Toolbar from './components/Toolbar.vue'
import InstanceRail from './components/InstanceRail.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import StatusCounts from './components/StatusCounts.vue'
import SearchBar from './components/SearchBar.vue'
import BlackboardRail from './components/BlackboardRail.vue'
import ZoomControls from './components/ZoomControls.vue'
import Timeline from './components/Timeline.vue'
import { useTreeStore, getNodeHeight } from './stores/treeStore'
import { useWebSocket } from './composables/useWebSocket'
import { usePanels, usePanelShortcuts } from './composables/usePanels'
import { useTooltip } from './composables/useTooltip'
import { useConnectionStore } from './stores/connectionStore'
import { useBlackboardStore } from './stores/blackboardStore'
import { useTimelineStore } from './stores/timelineStore'
import { bbNameForPath, extractPortTypes } from './lib/blackboard'
import type { BlackboardMap, TransitionRecord, TreeNode, WsMessage } from './types'

const store = useTreeStore()
const conn = useConnectionStore()
const bb = useBlackboardStore()
const timeline = useTimelineStore()
const connectionError = ref('')
const { panels } = usePanels()
usePanelShortcuts()

// ---- WebSocket ----
const { connect: wsConnect, send: wsSend, close: wsClose } = useWebSocket(handleMessage)

function handleMessage(msg: WsMessage) {
  switch (msg.type) {
    case 'connection_status':
      conn.connected = !!msg.connected
      conn.connecting = false
      if (msg.connected) {
        connectionError.value = ''
      } else if (msg.message) {
        connectionError.value = msg.message
        console.error('Connection failed:', msg.message)
      }
      if (msg.connected && msg.tree_xml) {
        loadTree(msg.tree_xml)
        nextTick(() => setTimeout(zoomFit, 100))
      }
      break
    case 'tree':
      if (typeof msg.data === 'string') {
        loadTree(msg.data)
        nextTick(() => setTimeout(zoomFit, 100))
      }
      break
    case 'status':
      if (msg.data && typeof msg.data === 'object') {
        store.updateStatus(msg.data as Record<string, string>)
      }
      break
    case 'blackboard':
      bb.update(msg.data as unknown as BlackboardMap | null)
      break
    case 'recording':
      timeline.setRecording(!!msg.active, Number(msg.start_epoch_us ?? 0))
      break
    case 'transitions':
      timeline.add(msg.data as unknown as TransitionRecord[])
      break
    case 'disconnected':
      conn.connected = false
      conn.connecting = false
      break
    case 'error':
      console.error('Server error:', msg.message)
      conn.connecting = false
      break
  }
}

// Parses a tree, then points the blackboard poll at the root instance.
function loadTree(xml: string) {
  store.parseTree(xml)
  bb.setPortTypes(extractPortTypes(new DOMParser().parseFromString(xml, 'text/xml')))
  setBlackboardTarget('')
}

function setBlackboardTarget(path: string) {
  const name = bbNameForPath(store.instances, path)
  if (!name) return
  bb.setTarget(name)
  wsSend({ type: 'set_blackboard_target', names: name })
}

// ---- Computed properties ----
const visibleNodes = computed<TreeNode[]>(() => {
  if (!store.treeData) return []
  const nodes: TreeNode[] = []
  const traverse = (n: TreeNode) => {
    nodes.push(n)
    n.children?.forEach(traverse)
  }
  traverse(store.treeData)
  return nodes
})

interface Connection {
  id: string
  path: string
}

const connections = computed<Connection[]>(() => {
  if (!store.treeData) return []
  const conns: Connection[] = []
  const isH = store.horizontal
  const traverse = (node: TreeNode) => {
    node.children?.forEach(child => {
      let sx: number, sy: number, ex: number, ey: number, path: string
      if (isH) {
        // Horizontal: parent right midpoint to child left midpoint
        sx = node.x + node.width
        sy = node.y + getNodeHeight(node) / 2
        ex = child.x
        ey = child.y + getNodeHeight(child) / 2
        const mx = (sx + ex) / 2
        path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`
      } else {
        // Vertical: parent bottom midpoint to child top midpoint
        sx = node.x + node.width / 2
        sy = node.y + getNodeHeight(node)
        ex = child.x + child.width / 2
        ey = child.y
        const my = (sy + ey) / 2
        path = `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`
      }
      conns.push({ id: `${node.uid}-${child.uid}`, path })
      traverse(child)
    })
  }
  traverse(store.treeData)
  return conns
})

// ---- Canvas state ----
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<SVGSVGElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const lastMouse = reactive({ x: 0, y: 0 })

// Search and follow: centre a node; a manual pan or zoom turns follow off.
const follow = ref(false)
const matchUids = ref<Set<string>>(new Set())

function panToNode(node: TreeNode) {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  panX.value = rect.width / 2 - (node.x + node.width / 2) * zoom.value
  panY.value = rect.height / 2 - (node.y + getNodeHeight(node) / 2) * zoom.value
}

let dragDistance = 0

function onMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    follow.value = false
    isDragging.value = true
    dragDistance = 0
    lastMouse.x = e.clientX
    lastMouse.y = e.clientY
  }
}

function onMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    dragDistance += Math.abs(e.clientX - lastMouse.x) + Math.abs(e.clientY - lastMouse.y)
    panX.value += e.clientX - lastMouse.x
    panY.value += e.clientY - lastMouse.y
    lastMouse.x = e.clientX
    lastMouse.y = e.clientY
  }
}

function onMouseUp() {
  isDragging.value = false
}

function onWheel(e: WheelEvent) {
  follow.value = false
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(3, zoom.value * delta))
  const rect = canvasRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  panX.value = mx - (mx - panX.value) * (newZoom / zoom.value)
  panY.value = my - (my - panY.value) * (newZoom / zoom.value)
  zoom.value = newZoom
}

function zoomIn() {
  zoom.value = Math.min(3, zoom.value * 1.2)
}
function zoomOut() {
  zoom.value = Math.max(0.1, zoom.value / 1.2)
}
function zoomReset() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}
function zoomFit() {
  const tree = store.treeData
  if (!tree || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const padding = 100
  const tw = (tree.treeWidth ?? tree.width) + padding
  const th = (tree.treeHeight ?? 100) + padding
  const sx = rect.width / tw
  const sy = rect.height / th
  const scale = Math.min(sx, sy) * 0.9
  zoom.value = Math.min(scale, 2)
  const sw = tw * zoom.value
  const sh = th * zoom.value
  panX.value = (rect.width - sw) / 2 + (padding / 2) * zoom.value
  panY.value = (rect.height - sh) / 2 + (padding / 2) * zoom.value
}

function onToggleLayout() {
  store.toggleLayout()
  nextTick(() => setTimeout(zoomFit, 50))
}

function onToggleSubtree(node: TreeNode) {
  store.toggleSubtree(node)
  nextTick(() => setTimeout(zoomFit, 100))
}

// A drag that ends on a subtree name pans only; the browser still fires click after it.
function onOpenSubtree(path: string) {
  if (dragDistance <= 3) onSelectInstance(path)
}

function onSelectInstance(path: string) {
  if (store.selectInstance(path)) {
    setBlackboardTarget(path)
    nextTick(() => setTimeout(zoomFit, 50))
  }
}

// A timeline row selects its node: switch to the node's instance if needed, then pan to it.
function onSelectTimelineNode(uid: number) {
  const info = store.uidInfo[String(uid)]
  const find = () => visibleNodes.value.find(n => n.uid === String(uid))
  let node = find()
  if (!node && info && info.block !== store.selectedPath && store.selectInstance(info.block)) {
    setBlackboardTarget(info.block)
    nextTick(() => {
      node = find()
      if (node) highlightAndPan(node)
    })
    return
  }
  if (node) highlightAndPan(node)
}

function highlightAndPan(node: TreeNode) {
  follow.value = false
  matchUids.value = new Set([node.uid])
  panToNode(node)
}

// ---- Tooltip ----
const { tooltip, tooltipAttrs, showTooltip, hideTooltip } = useTooltip()

// ---- Lifecycle ----
onMounted(() => {
  wsConnect()
  setTimeout(() => {
    if (!conn.connected && !conn.connecting) {
      conn.connecting = true
      wsSend({ type: 'connect', host: conn.host, port: conn.port })
    }
  }, 500)
})

onUnmounted(() => {
  wsClose()
})
</script>
