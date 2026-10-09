/** One-line text for a decoded blackboard scalar. Objects and arrays are not handled here. */
export function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return v
  return String(v)
}

/** True for `{"__bytes": hex}`, how the bridge sends a byte string. */
export function isBytes(v: unknown): v is { __bytes: string } {
  return typeof v === 'object' && v !== null && typeof (v as { __bytes?: unknown }).__bytes === 'string'
}

export function isContainer(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !isBytes(v)
}

/** Short text for a port value shown on a node; long text is cut. */
export function summarize(v: unknown, max = 24): string {
  let s: string
  if (isBytes(v)) s = `bytes(${v.__bytes.length / 2})`
  else if (Array.isArray(v)) s = `[${v.length}]`
  else if (isContainer(v)) s = `{${visibleEntries(v).length}}`
  else s = formatScalar(v)
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** Entries of an object or array, without the exporter's `__type` key. */
export function visibleEntries(v: object): [string, unknown][] {
  return Object.entries(v).filter(([k]) => k !== '__type')
}

/** `geometry_msgs::msg::Pose_<std::allocator<void> >` becomes `Pose`. */
export function shortTypeName(t: string): string {
  const s = t.replace(/_<std::allocator<void>\s*>$/, '')
  const i = s.lastIndexOf('::')
  return i >= 0 ? s.slice(i + 2) : s
}

/** Short type name of an object that has `__type`; empty string otherwise. */
export function typeLabel(v: unknown): string {
  if (!isContainer(v) || Array.isArray(v)) return ''
  const t = (v as { __type?: unknown }).__type
  return typeof t === 'string' ? shortTypeName(t) : ''
}
