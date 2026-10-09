import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BlackboardMap } from '@/types'
import { diffBlackboard } from '@/lib/blackboard'

const PIN_KEY = 'btm.pinnedKeys'
const FLASH_MS = 1000

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export const useBlackboardStore = defineStore('blackboard', () => {
  /** Instance name -> key -> value, as last broadcast by the bridge. */
  const maps = ref<BlackboardMap>({})
  /** Name of the instance whose blackboard the rail shows. */
  const target = ref('')
  const filter = ref('')
  const pinned = ref<string[]>(loadPins())
  const portTypes = ref<Record<string, string>>({})
  /** Keys that changed in the last second; the rail flashes them. */
  const flashing = ref<Set<string>>(new Set())
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const current = computed<Record<string, unknown>>(() => maps.value[target.value] ?? {})

  function setTarget(name: string) {
    if (name === target.value) return
    target.value = name
    clearFlash()
  }

  function clearFlash() {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
    flashing.value = new Set()
  }

  function update(data: BlackboardMap | null) {
    if (!data) return
    const diff = diffBlackboard(maps.value[target.value], data[target.value])
    maps.value = { ...maps.value, ...data }
    for (const k of [...diff.changed, ...diff.added]) {
      const next = new Set(flashing.value)
      next.add(k)
      flashing.value = next
      const old = timers.get(k)
      if (old) clearTimeout(old)
      timers.set(k, setTimeout(() => {
        timers.delete(k)
        const rest = new Set(flashing.value)
        rest.delete(k)
        flashing.value = rest
      }, FLASH_MS))
    }
  }

  function setPortTypes(types: Record<string, string>) {
    portTypes.value = types
  }

  function togglePin(key: string) {
    pinned.value = pinned.value.includes(key)
      ? pinned.value.filter(k => k !== key)
      : [...pinned.value, key]
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(pinned.value))
    } catch {
      /* storage unavailable: pins last for this session */
    }
  }

  const rows = computed(() => {
    const f = filter.value.trim().toLowerCase()
    const keys = Object.keys(current.value).filter(k => !f || k.toLowerCase().includes(f))
    const pins = pinned.value
    return keys
      .map(key => ({ key, value: current.value[key], pinned: pins.includes(key) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.key.localeCompare(b.key))
  })

  return {
    maps, target, filter, pinned, portTypes, flashing, current, rows,
    setTarget, update, setPortTypes, togglePin,
  }
})
