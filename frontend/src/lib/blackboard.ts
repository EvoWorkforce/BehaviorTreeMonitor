import type { InstanceNode } from '@/lib/instances'

export interface BlackboardDiff {
  changed: string[]
  added: string[]
  removed: string[]
}

/** Structural equality for decoded JSON values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every(
    k => Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}

/** Compares two blackboard maps; a missing map counts as empty. */
export function diffBlackboard(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): BlackboardDiff {
  const p = prev ?? {}
  const n = next ?? {}
  const out: BlackboardDiff = { changed: [], added: [], removed: [] }
  for (const k of Object.keys(n)) {
    if (!(k in p)) out.added.push(k)
    else if (!deepEqual(p[k], n[k])) out.changed.push(k)
  }
  for (const k of Object.keys(p)) if (!(k in n)) out.removed.push(k)
  return out
}

/** `{key}` -> the value of `key` in `bb`; undefined for a literal or an unknown key. */
export function resolvePortValue(raw: string, bb: Record<string, unknown> | null | undefined): unknown {
  const m = /^\{([^{}]+)\}$/.exec(raw.trim())
  if (!m || !bb) return undefined
  return Object.prototype.hasOwnProperty.call(bb, m[1]) ? bb[m[1]] : undefined
}

/** Text for a `null` value: the runtime could not export it as JSON. */
export function describeNull(key: string, portTypes: Record<string, string>): string {
  const t = portTypes[key]
  return t ? `not exported (${t})` : 'not exported'
}

/** Drops the allocator noise: `Pose_<std::allocator<void> >` -> `Pose`, `vector<T, allocator<T> >` -> `vector<T>`. */
export function cleanTypeName(t: string): string {
  return t
    .replace(/_<std::allocator<void>\s*>/g, '')
    .replace(/,\s*std::allocator<.*>\s*>$/, '>')
}

/**
 * Maps each blackboard key used as a `{key}` port value to the port type declared
 * in TreeNodesModel. Untyped ports (`BT::Any`) are skipped.
 */
export function extractPortTypes(doc: Document): Record<string, string> {
  const model: Record<string, string> = {}
  doc.querySelectorAll('TreeNodesModel > *').forEach(el => {
    const id = el.getAttribute('ID')
    if (!id) return
    for (const p of Array.from(el.children)) {
      const name = p.getAttribute('name')
      const type = p.getAttribute('type')
      if (name && type && !type.startsWith('BT::Any')) model[`${id}.${name}`] = cleanTypeName(type)
    }
  })
  const out: Record<string, string> = {}
  doc.querySelectorAll('BehaviorTree *').forEach(el => {
    const tag = el.getAttribute('ID') && el.tagName === 'SubTree' ? el.getAttribute('ID') : el.tagName
    for (const a of Array.from(el.attributes)) {
      const m = /^\{([^{}]+)\}$/.exec(a.value.trim())
      const name = a.name.replace(/^OUT:/, '')
      const t = m ? model[`${tag}.${name}`] : undefined
      if (m && t && !(m[1] in out)) out[m[1]] = t
    }
  })
  return out
}

/** The name to send in `set_blackboard_target` for the instance at `path`; null if unknown. */
export function bbNameForPath(root: InstanceNode | null, path: string): string | null {
  const walk = (n: InstanceNode): string | null => {
    if (n.path === path) return n.bbName
    for (const c of n.children) {
      const r = walk(c)
      if (r !== null) return r
    }
    return null
  }
  return root ? walk(root) : null
}
