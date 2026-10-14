import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSourceTree } from '../lib/source'
import { toLiveShape } from '../lib/liveShape'
import { listTrees, readTree } from '../lib/treeApi'
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

  return { files, current, text, sha, notice, sourceIndexByUid, refreshList, openText, openServerFile, openLocalFile, reload }
})
