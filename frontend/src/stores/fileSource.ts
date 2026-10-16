import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSourceTree } from '../lib/source'
import { toLiveShape, type ExtraDoc } from '../lib/liveShape'
import { collectIncludedSources, missingSubtreeIds, siblingCandidates, type SourceFile } from '../lib/includes'
import { planAttributeSave, type OpenSource } from '../lib/sourceSave'
import { listTrees, readTree, saveTree } from '../lib/treeApi'
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
  const sources = ref<Record<string, OpenSource>>({})
  const notice = ref('')
  const sourceIndexByUid = ref<Record<string, number>>({})
  const sourceFileByUid = ref<Record<string, string>>({})
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

  /** Show a loaded document set in the file view. On failure the previous file stays and `notice` says why. */
  function show(
    rootDoc: Document, extras: ExtraDoc[], open: Record<string, OpenSource>, file: OpenFile, message: string,
  ): boolean {
    const shaped = toLiveShape(rootDoc, extras)
    if ('error' in shaped) {
      notice.value = shaped.error
      return false
    }
    useFileTreeStore().parseTree(shaped.doc)
    sourceIndexByUid.value = shaped.sourceIndexByUid
    sourceFileByUid.value = shaped.sourceFileByUid
    closeEditor()
    current.value = file
    sources.value = open
    notice.value = message
    useViewStore().activeView = 'file'
    return true
  }

  /** Load a file from this computer. Its includes cannot be resolved: it has no folder. */
  function openText(source: string, file: OpenFile, fileSha: string): boolean {
    const loaded = loadSourceTree(source)
    if ('error' in loaded) {
      notice.value = loaded.error
      return false
    }
    const open = { '': { fileKey: '', id: file.id, text: source, sha256: fileSha, editable: file.editable } }
    const message = loaded.includes.length ? `Skipped <include>: ${loaded.includes.join(', ')}` : ''
    return show(loaded.doc, [], open, file, message)
  }

  async function openServerFile(info: TreeFileInfo): Promise<boolean> {
    try {
      const { text: source, sha256 } = await readTree(info.id)
      const loaded = loadSourceTree(source)
      if ('error' in loaded) {
        notice.value = loaded.error
        return false
      }
      const root: SourceFile = { info, text: source, sha256, doc: loaded.doc }
      const collected = await collectIncludedSources(root, files.value, readTree)
      if ('error' in collected) {
        notice.value = collected.error
        return false
      }
      const all = [...collected.sources]
      const notes: string[] = []
      let missing = missingSubtreeIds(all.map((f) => f.doc))
      for (const cand of siblingCandidates(info.path, files.value)) {
        if (!missing.length) break
        if (all.some((f) => f.info.path === cand.path)) continue
        const got = await readTree(cand.id)
        const candLoaded = loadSourceTree(got.text)
        if ('error' in candLoaded) continue
        const defined = Array.from(candLoaded.doc.getElementsByTagName('BehaviorTree')).map((e) => e.getAttribute('ID') ?? '')
        const found = missing.filter((id) => defined.includes(id))
        if (!found.length) continue
        all.push({ info: cand, text: got.text, sha256: got.sha256, doc: candLoaded.doc })
        for (const id of found) notes.push(`Resolved ${id} from ${cand.path}`)
        missing = missingSubtreeIds(all.map((f) => f.doc))
      }
      const open: Record<string, OpenSource> = {}
      const extras: ExtraDoc[] = []
      for (const f of all) {
        const fileKey = f === root ? '' : f.info.path
        open[fileKey] = { fileKey, id: f.info.id, text: f.text, sha256: f.sha256, editable: f.info.editable }
        if (f !== root) extras.push({ fileKey, doc: f.doc })
      }
      const name = info.path.split('/').pop() ?? info.path
      return show(root.doc, extras, open, { id: info.id, name, editable: info.editable, local: false }, notes.join('. '))
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
    const plan = planAttributeSave(uid, rows, sourceFileByUid.value, sourceIndexByUid.value, sources.value)
    if ('error' in plan) return { ok: false, message: plan.error }
    let res
    try {
      res = await saveTree(plan.id, plan.text, plan.baseSha256)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
    if (res.ok) {
      if (!(await reload())) return { ok: false, message: notice.value }
      const message = 'Saved. Rebuild and restart the program that loads it to run the change.'
      notice.value = notice.value ? `${message} ${notice.value}` : message
      return { ok: true, message }
    }
    if (res.status === 409) return { ok: false, conflict: true, message: 'File changed on disk. Reload to see the change.' }
    if (res.status === 403) return { ok: false, message: 'This file is not editable.' }
    return { ok: false, message: `Saving failed (${res.status})` }
  }

  return { editTarget, dirty, closeEditor, readOnlyReason, saveEdits, files, current, sources, notice, sourceIndexByUid, sourceFileByUid, refreshList, openText, openServerFile, openLocalFile, reload }
})
