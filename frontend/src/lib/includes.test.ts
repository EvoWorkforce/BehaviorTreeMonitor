import { describe, it, expect } from 'vitest'
import { resolveIncludePath, collectIncludedSources, missingSubtreeIds, siblingCandidates, resolveFromSiblings, type SourceFile } from './includes'
import { loadSourceTree } from './source'
import type { TreeFileInfo } from './treeFiles'
import mainXml from './__fixtures__/split/main_bt.xml?raw'
import walkXml from './__fixtures__/split/bt/walk.xml?raw'
import routeXml from './__fixtures__/split/bt/route.xml?raw'
import cycleA from './__fixtures__/split/bt/cycle_a.xml?raw'
import cycleB from './__fixtures__/split/bt/cycle_b.xml?raw'

const info = (path: string): TreeFileInfo => ({
  id: path,
  path,
  folder: path.slice(0, path.lastIndexOf('/')),
  editable: true,
})

const texts: Record<string, string> = {
  '/t/main_bt.xml': mainXml,
  '/t/bt/walk.xml': walkXml,
  '/t/bt/route.xml': routeXml,
  '/t/bt/cycle_a.xml': cycleA,
  '/t/bt/cycle_b.xml': cycleB,
}
const files = Object.keys(texts).map(info)

function rootOf(path: string, text = texts[path]): SourceFile {
  const loaded = loadSourceTree(text)
  if ('error' in loaded) throw new Error(loaded.error)
  return { info: info(path), text, sha256: 'sha-' + path, doc: loaded.doc }
}

function makeRead(overrides: Record<string, string> = {}) {
  const calls: string[] = []
  const read = async (id: string) => {
    calls.push(id)
    const text = overrides[id] ?? texts[id]
    if (text === undefined) throw new Error('unknown ' + id)
    return { text, sha256: 'sha-' + id }
  }
  return { read, calls }
}

describe('resolveIncludePath', () => {
  it('resolves bt/a.xml from /t/main_bt.xml', () => {
    expect(resolveIncludePath('/t/main_bt.xml', 'bt/a.xml')).toBe('/t/bt/a.xml')
  })
  it('normalises ../ and ./', () => {
    expect(resolveIncludePath('/t/bt/x.xml', '../b.xml')).toBe('/t/b.xml')
    expect(resolveIncludePath('/t/main_bt.xml', './c.xml')).toBe('/t/c.xml')
  })
})

describe('collectIncludedSources', () => {
  it('collects main + two includes', async () => {
    const { read, calls } = makeRead()
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml'), files, read)
    expect('sources' in r).toBe(true)
    if ('sources' in r) expect(r.sources.map((s) => s.info.path)).toEqual(['/t/main_bt.xml', '/t/bt/walk.xml', '/t/bt/route.xml'])
    expect(calls).toHaveLength(2)
  })

  it('resolves a nested include against the included file folder', async () => {
    const main = '<root BTCPP_format="4"><include path="bt/outer.xml"/><BehaviorTree ID="m"><AlwaysSuccess/></BehaviorTree></root>'
    const outer = '<root BTCPP_format="4"><include path="inner.xml"/><BehaviorTree ID="O"><AlwaysSuccess/></BehaviorTree></root>'
    const inner = '<root BTCPP_format="4"><BehaviorTree ID="I"><AlwaysSuccess/></BehaviorTree></root>'
    const fs = ['/t/main_bt.xml', '/t/bt/outer.xml', '/t/bt/inner.xml'].map(info)
    const { read } = makeRead({ '/t/bt/outer.xml': outer, '/t/bt/inner.xml': inner })
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml', main), fs, read)
    expect('sources' in r).toBe(true)
    if ('sources' in r) expect(r.sources.map((s) => s.info.path)).toContain('/t/bt/inner.xml')
  })

  it('reports a missing include by name', async () => {
    const main = '<root BTCPP_format="4"><include path="bt/missing.xml"/><BehaviorTree ID="m"><AlwaysSuccess/></BehaviorTree></root>'
    const { read } = makeRead()
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml', main), files, read)
    expect('error' in r && r.error).toContain('bt/missing.xml')
    expect('error' in r && r.error).toContain('not in the tree folders')
  })

  it('reports a cycle naming both files', async () => {
    const main = '<root BTCPP_format="4"><include path="bt/cycle_a.xml"/><BehaviorTree ID="m"><AlwaysSuccess/></BehaviorTree></root>'
    const { read } = makeRead()
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml', main), files, read)
    expect('error' in r).toBe(true)
    if ('error' in r) {
      expect(r.error).toContain('cycle_a.xml')
      expect(r.error).toContain('cycle_b.xml')
    }
  })

  it('reports a duplicate BehaviorTree ID with the ID and both files', async () => {
    const dup = '<root BTCPP_format="4"><BehaviorTree ID="WalkPhase"><AlwaysSuccess/></BehaviorTree></root>'
    const { read } = makeRead({ '/t/bt/route.xml': dup })
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml'), files, read)
    expect('error' in r).toBe(true)
    if ('error' in r) {
      expect(r.error).toContain('WalkPhase')
      expect(r.error).toContain('walk.xml')
      expect(r.error).toContain('route.xml')
    }
  })

  it('refuses a ros_pkg include', async () => {
    const main = '<root BTCPP_format="4"><include path="x.xml" ros_pkg="aom"/><BehaviorTree ID="m"><AlwaysSuccess/></BehaviorTree></root>'
    const { read } = makeRead()
    const r = await collectIncludedSources(rootOf('/t/main_bt.xml', main), files, read)
    expect('error' in r && r.error).toContain('ros_pkg')
    expect('error' in r && r.error).toContain('not resolved')
  })
})

describe('missingSubtreeIds', () => {
  const doc = (s: string) => {
    const l = loadSourceTree(s)
    if ('error' in l) throw new Error(l.error)
    return l.doc
  }
  it('lists only SubTree IDs no document defines', () => {
    const a = doc(`<root BTCPP_format="4" main_tree_to_execute="m"><BehaviorTree ID="m"><Sequence><SubTree ID="A"/><SubTree ID="B"/><SubTree ID="B"/></Sequence></BehaviorTree></root>`)
    const b = doc(`<root BTCPP_format="4"><BehaviorTree ID="A"><SubTree ID="C"/></BehaviorTree></root>`)
    expect(missingSubtreeIds([a, b])).toEqual(['B', 'C'])
  })
})

describe('siblingCandidates', () => {
  const f = (path: string): TreeFileInfo => ({ id: path, path, folder: path.slice(0, path.lastIndexOf('/')), editable: true })
  it('orders same-folder files before parent-folder files and excludes the root', () => {
    const all = ['/t/p/root.xml', '/t/p/a.xml', '/t/b.xml', '/t/p/sub/c.xml', '/x/d.xml', '/t/p/z.xml'].map(f)
    expect(siblingCandidates('/t/p/root.xml', all).map((x) => x.path)).toEqual(['/t/p/a.xml', '/t/p/z.xml', '/t/b.xml'])
  })
})

describe('resolveFromSiblings', () => {
  const tree = (id: string, body: string) => `<root BTCPP_format="4"><BehaviorTree ID="${id}">${body}</BehaviorTree></root>`
  const rootXml = '<root BTCPP_format="4" main_tree_to_execute="M"><BehaviorTree ID="M"><SubTree ID="A"/></BehaviorTree></root>'

  it('resolves a chain whose definitions sit in reverse file order', async () => {
    const t: Record<string, string> = {
      '/s/root.xml': rootXml,
      '/s/a.xml': tree('B', '<AlwaysSuccess/>'),
      '/s/z.xml': tree('A', '<SubTree ID="B"/>'),
    }
    const fs = Object.keys(t).map(info)
    const read = async (id: string) => ({ text: t[id], sha256: 'sha-' + id })
    const r = await resolveFromSiblings('/s/root.xml', fs, [rootOf('/s/root.xml', rootXml)], read)
    expect(r.sources.map((x) => x.info.path).sort()).toEqual(['/s/a.xml', '/s/z.xml'])
    expect(r.notes).toContain('Resolved A from /s/z.xml')
    expect(r.notes).toContain('Resolved B from /s/a.xml')
  })

  it('terminates and returns when an ID stays missing', async () => {
    const t: Record<string, string> = {
      '/s/root.xml': rootXml,
      '/s/a.xml': tree('A', '<SubTree ID="Nope"/>'),
    }
    const fs = Object.keys(t).map(info)
    const read = async (id: string) => ({ text: t[id], sha256: 'sha-' + id })
    const r = await resolveFromSiblings('/s/root.xml', fs, [rootOf('/s/root.xml', rootXml)], read)
    expect(r.sources.map((x) => x.info.path)).toEqual(['/s/a.xml'])
    expect(r.notes).toEqual(['Resolved A from /s/a.xml'])
  })
})
