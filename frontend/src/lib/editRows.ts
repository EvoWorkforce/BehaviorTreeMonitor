// Pure helpers for the node edit popover (offline file view).

export interface EditRow {
  name: string
  value: string
}

export interface PopoverRow extends EditRow {
  long: boolean
}

const LONG_VALUE = 60

/** Rows to show for a node: its attributes without ID and `_*`, plus an empty `name` when absent. */
export function popoverRows(attributes: Record<string, string>): PopoverRow[] {
  const rows: PopoverRow[] = []
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'ID' || name.startsWith('_')) continue
    rows.push({ name, value, long: value.length > LONG_VALUE })
  }
  if (!rows.some((r) => r.name === 'name')) rows.push({ name: 'name', value: '', long: false })
  return rows
}

/** The rows whose value differs from `before`. A row missing from `before` counts as empty. */
export function diffRows(before: EditRow[], after: EditRow[]): EditRow[] {
  const old = new Map(before.map((r) => [r.name, r.value]))
  return after
    .filter((r) => r.value !== (old.get(r.name) ?? ''))
    .map((r) => ({ name: r.name, value: r.value }))
}
