<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="toolbar-title">
        <img src="/favicon.svg" alt="Evo" class="toolbar-logo" />
        <span>Evo Behavior Tree Monitor</span>
      </div>
      <OpenMenu @opened="emit('opened')" />
      <SourceBadge />
      <div v-if="canSwitch" class="view-switch" role="group" aria-label="View">
        <button class="btn" :aria-pressed="view.activeView === 'live'" @click="view.activeView = 'live'">Live</button>
        <button class="btn" :aria-pressed="view.activeView === 'file'" @click="view.activeView = 'file'">File</button>
      </div>
      <button
        v-if="view.activeView === 'file'"
        class="btn"
        :disabled="!canReload"
        :title="canReload ? 'Read the file again' : 'A file from this computer cannot be reloaded; open it again'"
        @click="onReload"
      >Reload</button>
    </div>

    <div class="panel-toggles" role="group" aria-label="Panels">
      <button class="btn btn-icon" :aria-pressed="panels.leftOpen" title="Instances ( [ )" @click="toggle('left')">
        <IconPanelLeft />
      </button>
      <button class="btn btn-icon" :aria-pressed="panels.bottomOpen" title="Timeline" @click="toggle('bottom')">
        <IconPanelBottom />
      </button>
      <button class="btn btn-icon" :aria-pressed="panels.rightOpen" title="Blackboard ( ] )" @click="toggle('right')">
        <IconPanelRight />
      </button>
    </div>

    <div class="connection-panel">
      <input v-model="store.host" class="host" type="text" placeholder="localhost" :disabled="store.connected" />
      <span style="color: var(--text-muted)">:</span>
      <input v-model.number="store.port" class="port" type="number" placeholder="1667" :disabled="store.connected" />
      <button class="btn" :class="store.connected ? 'btn-danger' : 'btn-primary'" @click="toggleConnection">
        {{ store.connecting ? 'Connecting...' : store.connected ? 'Disconnect' : 'Connect' }}
      </button>
      <button class="btn btn-icon" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">
        <IconSun v-if="theme === 'dark'" />
        <IconMoon v-else />
      </button>
      <div class="status-indicator" :class="connectionStatus">
        <span class="status-dot"></span>
        <span>{{ statusText }}</span>
      </div>
      <span v-if="connectionError" class="connection-error" :title="connectionError">{{ connectionError }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '../stores/connectionStore'
import { useTheme } from '../composables/useTheme'
import { usePanels } from '../composables/usePanels'
import IconPanelLeft from './icons/IconPanelLeft.vue'
import IconPanelBottom from './icons/IconPanelBottom.vue'
import IconPanelRight from './icons/IconPanelRight.vue'
import IconSun from './icons/IconSun.vue'
import IconMoon from './icons/IconMoon.vue'
import OpenMenu from './OpenMenu.vue'
import SourceBadge from './SourceBadge.vue'
import { useViewStore } from '../stores/viewStore'
import { useFileSourceStore } from '../stores/fileSource'
import { useTreeStore, useFileTreeStore } from '../stores/treeStore'

const props = defineProps<{
  connectionError: string
  send: (msg: Record<string, unknown>) => void
}>()

const emit = defineEmits<{ (e: 'opened'): void }>()

const store = useConnectionStore()
const view = useViewStore()
const src = useFileSourceStore()
const liveTree = useTreeStore()
const fileTree = useFileTreeStore()
const canSwitch = computed(() => !!liveTree.treeData && !!fileTree.treeData)
const canReload = computed(() => !!src.current && !src.current.local)

async function onReload() {
  if (await src.reload()) emit('opened')
}
const { theme, toggle: toggleTheme } = useTheme()
const { panels, toggle } = usePanels()

function toggleConnection() {
  if (store.connected) {
    props.send({ type: 'disconnect' })
    store.connected = false
  } else {
    store.connecting = true
    props.send({ type: 'connect', host: store.host, port: store.port })
  }
}

const connectionStatus = computed(() => {
  if (store.connecting) return 'connecting'
  if (store.connected) return 'connected'
  return 'disconnected'
})

const statusText = computed(() => {
  if (store.connecting) return 'Connecting...'
  if (store.connected) return 'Connected'
  if (props.connectionError) return 'Connection failed'
  return 'Not connected'
})
</script>
