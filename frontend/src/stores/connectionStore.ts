import { defineStore } from 'pinia'
import { ref } from 'vue'

/** WebSocket connection state to the BT server; independent of which tree is shown. */
export const useConnectionStore = defineStore('connection', () => {
  const connected = ref(false)
  const connecting = ref(false)
  const host = ref('localhost')
  const port = ref(1667)
  return { connected, connecting, host, port }
})
