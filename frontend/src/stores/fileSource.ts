import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSourceTree } from '../lib/source'
import { toLiveShape } from '../lib/liveShape'
import { listTrees, readTree, saveTree } from '../lib/treeApi'
import { applyAttributeEdits } from '../lib/sourceEdit'
import type { EditRow } from '../lib/editRows'
import type { TreeNode } from '../types'
import type { TreeFileInfo } from '../lib/treeFiles'
import { useFileTreeStore } from './treeStore'
import { useViewStore } from './viewStore'

export interface OpenFile {
  id: string | null
  name: string
  editable: boolean
  local: boolean
}

/** The file shown in the file view: where it came from, its text and a notice for the user. */
export const useFileSourceStore = defineStore('fileSource', () => {
  const files = ref<TreeFileInfo[]>([])
  const current = ref<OpenFile | null>(null)
  const text = ref('')
  const sha = ref('')
  const notice = ref('')
  const sourceIndexByUid = ref<Record<string, number>>({})
  /** The node whose edit popover is open, and whether it holds unsaved changes. */
  const editTarget = ref<{ node: TreeNode; rect: { left: number; top: number; bottom: number } } | null>(null)
  const dirty = ref(false)

  function closeEditor() {
    editTarget.value = null
    dirty.value = false
  }

  async function refreshList() {
    try {
      files.value = await listTrees()
    } catch {
      files.value = []
    }
  }

  /** Load source text into the file view. On failure the previous file stays and `notice` says why. */
  function openText(source: string, file: OpenFile, fileSha: string): boolean {
    const loaded = loadSourceTree(source)
    if ('error' in loaded) {
      notice.value = loaded.error
      return false
    }
    const shaped = toLiveShape(loaded.doc)
    if ('error' in shaped) {
      notice.value = shaped.error
      return false
    }
    useFileTreeStore().parseTree(shaped.doc)
    sourceIndexByUid.value = shaped.sourceIndexByUid
    closeEditor()
    current.value = file
    text.value = source
    sha.value = fileSha
    notice.value = loaded.includes.length ? `Skipped <include>: ${loaded.includes.join(', ')}` : ''
    useViewStore().activeView = 'file'
    return true
  }

  async function openServerFile(info: TreeFileInfo): Promise<boolean> {
    try {
      const { text: source, sha256 } = await readTree(info.id)
      const name = info.path.split('/').pop() ?? info.path
      return openText(source, { id: info.id, name, editable: info.editable, local: false }, sha256)
    } catch (e) {
      notice.value = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  async function openLocalFile(file: File): Promise<boolean> {
    return openText(await file.text(), { id: null, name: file.name, editable: false, local: true }, '')
  }

  /** Re-read the current server file. A local file has no handle, so it cannot be reloaded. */
  async function reload(): Promise<boolean> {
    const cur = current.value
    if (!cur || cur.local || !cur.id) return false
    const info = files.value.find((f) => f.id === cur.id)
    return openServerFile(info ?? { id: cur.id, path: cur.name, folder: '', editable: cur.editable })
  }

  /** Why the current file cannot be edited, or '' when it can. */
  function readOnlyReason(): string {
    const cur = current.value
    if (!cur) return 'No file is open.'
    if (cur.local) return 'A file opened from this computer is view only.'
    if (!cur.editable) return 'This file is outside the edit folders, so it is view only.'
    return ''
  }

  /** Write the changed attribute rows of one node into the file text and save it. */
  async function saveEdits(uid: string, rows: EditRow[]): Promise<{ ok: boolean; conflict?: boolean; message: string }> {
    const cur = current.value
    const reason = readOnlyReason()
    if (!cur || !cur.id || reason) return { ok: false, message: reason }
    const idx = sourceIndexByUid.value[uid]
    if (idx === undefined) return { ok: false, message: 'This node has no place in the file.' }
    let next: string
    try {
      next = applyAttributeEdits(text.value, rows.map((r) => ({ elementIndex: idx, name: r.name, value: r.value })))
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
    let res
    try {
      res = await saveTree(cur.id, next, sha.value)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
    if (res.ok) {
      if (!openText(next, cur, res.sha256)) return { ok: false, message: notice.value }
      const message = 'Saved. Rebuild and restart the program that loads it to run the change.'
      notice.value = notice.value ? `${message} ${notice.value}` : message
      return { ok: true, message }
    }
    if (res.status === 409) return { ok: false, conflict: true, message: 'File changed on disk. Reload to see the change.' }
    if (res.status === 403) return { ok: false, message: 'This file is not editable.' }
    return { ok: false, message: `Saving failed (${res.status})` }
  }

  return { editTarget, dirty, closeEditor, readOnlyReason, saveEdits, files, current, text, sha, notice, sourceIndexByUid, refreshList, openText, openServerFile, openLocalFile, reload }
})
