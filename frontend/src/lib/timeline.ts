import type { NodeStatusStr, TransitionRecord } from '@/types'

/** Most records the timeline keeps; the oldest go first. */
export const MAX_TRANSITIONS = 50000

export interface LaneEvent {
  timestamp_us: number
  status: NodeStatusStr
  /** Status of the same node before this event; null for its first record. */
  prev: NodeStatusStr | null
}

export interface Lane {
  uid: number
  path: string
  events: LaneEvent[]
}

/** Where a node lives: its label, and the instance (block) that holds it. */
export interface UidInfo {
  path: string
  /** `_fullpath` of the BehaviorTree block holding the node; empty for the root block. */
  block: string
}

/**
 * Maps every `_uid` in a FULLTREE document to a readable path
 * (`<instance path>/<node name>`) and to its block, so inline-expanded nodes resolve too.
 */
export function buildUidPaths(doc: Document): Record<string, UidInfo> {
  const out: Record<string, UidInfo> = {}
  for (const block of Array.from(doc.querySelectorAll('BehaviorTree'))) {
    const blockPath = block.getAttribute('_fullpath') ?? ''
    const prefix = blockPath || block.getAttribute('ID') || ''
    for (const el of Array.from(block.querySelectorAll('[_uid]'))) {
      const uid = el.getAttribute('_uid')
      if (!uid) continue
      const name = el.getAttribute('name') || el.getAttribute('ID') || el.tagName
      out[uid] = { path: prefix ? `${prefix}/${name}` : name, block: blockPath }
    }
  }
  return out
}

/** Groups records by node, in first-seen order; each lane is time-ordered with its previous status. */
export function toLanes(transitions: TransitionRecord[], uidToPath: Record<string, string>): Lane[] {
  const sorted = transitions
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.timestamp_us - b.r.timestamp_us || a.i - b.i)
  const lanes = new Map<number, Lane>()
  for (const { r } of sorted) {
    let lane = lanes.get(r.uid)
    if (!lane) {
      lane = { uid: r.uid, path: uidToPath[String(r.uid)] ?? `uid ${r.uid}`, events: [] }
      lanes.set(r.uid, lane)
    }
    const prev = lane.events.length ? lane.events[lane.events.length - 1].status : null
    lane.events.push({ timestamp_us: r.timestamp_us, status: r.status, prev })
  }
  return Array.from(lanes.values())
}

/** Keeps the newest `max` records. */
export function capTransitions(list: TransitionRecord[], max: number): TransitionRecord[] {
  return list.length > max ? list.slice(list.length - max) : list
}

export function exportJson(transitions: TransitionRecord[]): string {
  return JSON.stringify(transitions, null, 2)
}
