// Thin fetch wrapper for the server's /api/trees routes.
import type { TreeFileInfo } from './treeFiles'

export async function listTrees(): Promise<TreeFileInfo[]> {
  const res = await fetch('/api/trees')
  if (!res.ok) throw new Error(`Listing tree files failed (${res.status})`)
  return res.json()
}

export async function readTree(id: string): Promise<{ text: string; sha256: string }> {
  const res = await fetch(`/api/trees/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Reading the tree file failed (${res.status})`)
  return res.json()
}

export type SaveResult = { ok: true; sha256: string } | { ok: false; status: number; sha256?: string }

export async function saveTree(id: string, text: string, baseSha256: string): Promise<SaveResult> {
  const res = await fetch(`/api/trees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, base_sha256: baseSha256 }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, sha256: body.sha256 }
  return { ok: false, status: res.status, sha256: body.sha256 }
}
