import { describe, it, expect } from 'vitest'
import { resolveIncludePath, collectIncludedSources, type SourceFile } from './includes'
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
