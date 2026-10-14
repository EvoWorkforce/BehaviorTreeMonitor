// Pure helpers for the Open menu, the source badge and the empty canvas text.

export interface TreeFileInfo {
  id: string
  path: string
  folder: string
  editable: boolean
}

/** Group files by folder; groups and files keep the order they arrive in. */
export function groupByFolder(files: TreeFileInfo[]): { folder: string; files: TreeFileInfo[] }[] {
  const groups: { folder: string; files: TreeFileInfo[] }[] = []
  for (const file of files) {
    let group = groups.find((g) => g.folder === file.folder)
    if (!group) {
      group = { folder: file.folder, files: [] }
      groups.push(group)
    }
    group.files.push(file)
  }
  return groups
}

export function sourceLabel(
  view: 'live' | 'file',
  conn: { host: string; port: number; connected: boolean },
  file?: { name: string; editable: boolean; local: boolean },
): string {
  if (view === 'live' || !file) return `live ${conn.host}:${conn.port}`
  return file.editable && !file.local ? file.name : `${file.name} (view only)`
}

export function canvasEmptyText(
  view: 'live' | 'file',
  connected: boolean,
  hasTree: boolean,
): { title: string; body: string } {
  if (view === 'file') {
    return hasTree
      ? { title: '', body: '' }
      : { title: 'Open a tree file', body: 'Use Open in the toolbar to pick a file' }
  }
  if (connected) return { title: 'Waiting for behavior tree data...', body: 'Fetching the tree structure' }
  return { title: 'Not connected to a BT server', body: 'Enter the server address and click Connect' }
}
