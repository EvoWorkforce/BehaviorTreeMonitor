<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="toolbar-title">
        <img src="/favicon.svg" alt="Evo" class="toolbar-logo" />
        <span>Evo Behavior Tree Monitor</span>
      </div>
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
import { useTreeStore } from '../stores/treeStore'
import { useTheme } from '../composables/useTheme'
import IconSun from './icons/IconSun.vue'
import IconMoon from './icons/IconMoon.vue'

const props = defineProps<{
  connectionError: string
  send: (msg: Record<string, unknown>) => void
}>()

const store = useTreeStore()
const { theme, toggle: toggleTheme } = useTheme()

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
