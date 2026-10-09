export interface PanelState {
  leftOpen: boolean
  rightOpen: boolean
  bottomOpen: boolean
  leftWidth: number
  rightWidth: number
  bottomHeight: number
}

export const DEFAULT_PANELS: PanelState = {
  leftOpen: true,
  rightOpen: true,
  bottomOpen: false,
  leftWidth: 220,
  rightWidth: 300,
  bottomHeight: 240,
}

const KEY = 'btm.panels'

/** False when the key event comes from a field where the user is typing. */
export function shouldHandleShortcut(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return true
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false
  const ce = el.getAttribute?.('contenteditable')
  if (el.isContentEditable || (ce !== null && ce !== undefined && ce !== 'false')) return false
  return true
}

export function loadPanels(storage: Storage | null): PanelState {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return { ...DEFAULT_PANELS }
    const parsed = JSON.parse(raw) as Partial<PanelState>
    const out: PanelState = { ...DEFAULT_PANELS }
    for (const k of Object.keys(DEFAULT_PANELS) as (keyof PanelState)[]) {
      if (typeof parsed[k] === typeof DEFAULT_PANELS[k]) {
        ;(out as unknown as Record<string, unknown>)[k] = parsed[k]
      }
    }
    return out
  } catch {
    return { ...DEFAULT_PANELS }
  }
}

export function savePanels(storage: Storage | null, state: PanelState): void {
  try {
    storage?.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: the layout is simply not remembered
  }
}
