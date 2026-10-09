import { reactive, watch, onMounted, onUnmounted } from 'vue'
import { loadPanels, savePanels, shouldHandleShortcut, togglePanel, type PanelSide } from '@/lib/panels'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// One shared copy, so the toolbar buttons, the panel close buttons and App.vue see the same state.
const panels = reactive(loadPanels(storage()))
watch(panels, p => savePanels(storage(), { ...p }))

function toggle(side: PanelSide) {
  Object.assign(panels, togglePanel(panels, side))
}

/** Shared open state and sizes of the left, right and bottom panels. */
export function usePanels() {
  return { panels, toggle }
}

/** `[` and `]` toggle the side rails; call once, from App.vue. */
export function usePanelShortcuts() {
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (!shouldHandleShortcut(e.target)) return
    if (e.key === '[') toggle('left')
    else if (e.key === ']') toggle('right')
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}
