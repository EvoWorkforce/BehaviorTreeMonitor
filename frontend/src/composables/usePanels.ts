import { reactive, watch, onMounted, onUnmounted } from 'vue'
import { loadPanels, savePanels, shouldHandleShortcut } from '@/lib/panels'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Open state and sizes of the left, right and bottom panels; `[` and `]` toggle the side rails. */
export function usePanels() {
  const panels = reactive(loadPanels(storage()))

  watch(panels, p => savePanels(storage(), { ...p }))

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (!shouldHandleShortcut(e.target)) return
    if (e.key === '[') panels.leftOpen = !panels.leftOpen
    else if (e.key === ']') panels.rightOpen = !panels.rightOpen
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))

  return { panels }
}
