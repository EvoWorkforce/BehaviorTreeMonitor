import { ref, type Ref } from 'vue'
import type { WsMessage } from '@/types'

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const ws: Ref<WebSocket | null> = ref(null)

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`
    const socket = new WebSocket(url)

    socket.onopen = () => {
      console.log('WebSocket connected')
    }

    socket.onmessage = (event: MessageEvent) => {
      const data: WsMessage = JSON.parse(event.data as string)
      onMessage(data)
    }

    socket.onclose = () => {
      console.log('WebSocket closed, reconnecting in 3 s')
      ws.value = null
      setTimeout(connect, 3000)
    }

    socket.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    ws.value = socket
  }

  function send(data: Record<string, unknown>) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    }
  }

  function close() {
    ws.value?.close()
    ws.value = null
  }

  return { connect, send, close }
}
