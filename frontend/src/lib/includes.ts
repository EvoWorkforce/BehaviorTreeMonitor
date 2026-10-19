// Resolve <include> files of a behaviour-tree source file against the served tree list.

import { loadSourceTree } from './source'
import type { TreeFileInfo } from './treeFiles'

export type SourceFile = { info: TreeFileInfo; text: string; sha256: string; doc: Document }

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

/** Join the folder of the including file with a relative path; normalise `.` and `..` (POSIX). */
export function resolveIncludePath(includingPath: string, includePath: string): string {
  const absolute = includePath.startsWith('/') || includingPath.startsWith('/')
  const joined = includePath.startsWith('/') ? includePath : `${dirname(includingPath)}/${includePath}`
  const out: string[] = []
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return (absolute ? '/' : '') + out.join('/')
}

function treeIds(doc: Document): string[] {
  return Array.from(doc.getElementsByTagName('BehaviorTree'))
    .map((e) => e.getAttribute('ID') ?? '')
    .filter((id) => id !== '')
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Walk includes depth-first from `root`. `read` is injected so tests need no fetch. */
export async function collectIncludedSources(
  root: SourceFile,
  files: TreeFileInfo[],
  read: (id: string) => Promise<{ text: string; sha256: string }>,
): Promise<{ sources: SourceFile[] } | { error: string }> {
  const sources: SourceFile[] = []
  const owner = new Map<string, string>() // BehaviorTree ID -> file path
  const visiting: string[] = []
  const done = new Set<string>()

  async function visit(file: SourceFile): Promise<string | null> {
    visiting.push(file.info.path)
    sources.push(file)
    for (const id of treeIds(file.doc)) {
      const prior = owner.get(id)
      if (prior !== undefined && prior !== file.info.path) {
        return `BehaviorTree "${id}" is defined in both ${prior} and ${file.info.path}`
      }
      owner.set(id, file.info.path)
    }
    for (const el of Array.from(file.doc.getElementsByTagName('include'))) {
      const rel = el.getAttribute('path') ?? ''
      if (el.getAttribute('ros_pkg')) {
        return `${file.info.path}: include "${rel}" uses ros_pkg, which is not resolved here`
      }
      const target = resolveIncludePath(file.info.path, rel)
      if (visiting.includes(target)) {
        return `Include cycle: ${file.info.path} and ${target} (${fileName(file.info.path)} -> ${fileName(target)})`
      }
      if (done.has(target)) continue
      const info = files.find((f) => f.path === target)
      if (!info) return `${file.info.path}: include "${rel}" is not in the tree folders`
      const got = await read(info.id)
      const loaded = loadSourceTree(got.text)
      if ('error' in loaded) return `${info.path}: ${loaded.error}`
      const err = await visit({ info, text: got.text, sha256: got.sha256, doc: loaded.doc })
      if (err) return err
    }
    visiting.pop()
    done.add(file.info.path)
    return null
  }

  const err = await visit(root)
  return err ? { error: err } : { sources }
}

/** SubTree IDs that some document calls and no document defines, in first-call order. */
export function missingSubtreeIds(docs: Document[]): string[] {
  const defined = new Set(docs.flatMap(treeIds))
  const missing: string[] = []
  for (const d of docs) {
    for (const el of Array.from(d.getElementsByTagName('SubTree'))) {
      const id = el.getAttribute('ID') ?? ''
      if (id !== '' && !defined.has(id) && !missing.includes(id)) missing.push(id)
    }
  }
  return missing
}

/** Files in the root's folder, then in its parent folder; the root itself is excluded. */
export function siblingCandidates(rootPath: string, files: TreeFileInfo[]): TreeFileInfo[] {
  const dir = dirname(rootPath)
  const parent = dirname(dir)
  const inDir = (d: string) => files.filter((f) => f.path !== rootPath && dirname(f.path) === d)
  return dir === '' ? inDir(dir) : [...inDir(dir), ...inDir(parent)]
}

/**
 * Add sibling files that define still-missing SubTree IDs. Repeats passes until one adds nothing,
 * so the order of the candidates does not matter. Returns only the added sources, plus one
 * "Resolved <ID> from <path>" note per resolved ID.
 */
export async function resolveFromSiblings(
  rootPath: string,
  files: TreeFileInfo[],
  sources: SourceFile[],
  read: (id: string) => Promise<{ text: string; sha256: string }>,
): Promise<{ sources: SourceFile[]; notes: string[] }> {
  const all = [...sources]
  const added: SourceFile[] = []
  const notes: string[] = []
  let missing = missingSubtreeIds(all.map((f) => f.doc))
  let grew = true
  while (grew && missing.length) {
    grew = false
    for (const cand of siblingCandidates(rootPath, files)) {
      if (!missing.length) break
      if (all.some((f) => f.info.path === cand.path)) continue
      const got = await read(cand.id)
      const loaded = loadSourceTree(got.text)
      if ('error' in loaded) continue
      const defined = Array.from(loaded.doc.getElementsByTagName('BehaviorTree')).map((e) => e.getAttribute('ID') ?? '')
      const found = missing.filter((id) => defined.includes(id))
      if (!found.length) continue
      const file: SourceFile = { info: cand, text: got.text, sha256: got.sha256, doc: loaded.doc }
      all.push(file)
      added.push(file)
      grew = true
      for (const id of found) notes.push(`Resolved ${id} from ${cand.path}`)
      missing = missingSubtreeIds(all.map((f) => f.doc))
    }
  }
  return { sources: added, notes }
}
