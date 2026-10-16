// Pick the file that defines a node and patch that file's text.

import { applyAttributeEdits } from './sourceEdit'
import type { EditRow } from './editRows'

export type OpenSource = { fileKey: string; id: string | null; text: string; sha256: string; editable: boolean }

/** Plan one save: the owning file's id, its patched text and the sha the save is based on. */
export function planAttributeSave(
  uid: string, rows: EditRow[],
  sourceFileByUid: Record<string, string>, sourceIndexByUid: Record<string, number>,
  sources: Record<string, OpenSource>,
): { id: string; text: string; baseSha256: string } | { error: string } {
  const fileKey = sourceFileByUid[uid]
  const idx = sourceIndexByUid[uid]
  const src = fileKey === undefined ? undefined : sources[fileKey]
  if (!src || idx === undefined) return { error: 'This node has no place in the file.' }
  if (src.id === null) return { error: 'A file opened from this computer is view only.' }
  if (!src.editable) return { error: 'This file is outside the edit folders, so it is view only.' }
  try {
    const text = applyAttributeEdits(src.text, rows.map((r) => ({ elementIndex: idx, name: r.name, value: r.value })))
    return { id: src.id, text, baseSha256: src.sha256 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
