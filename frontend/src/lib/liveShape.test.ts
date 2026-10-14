import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/stores/treeStore'
import { buildInstanceTree } from '@/lib/instances'
import { loadSourceTree } from '@/lib/source'
import { toLiveShape } from '@/lib/liveShape'
import xml from './__fixtures__/main_bt.source.xml?raw'

function shaped(src: string) {
  const loaded = loadSourceTree(src)
  if ('error' in loaded) throw new Error(loaded.error)
  const r = toLiveShape(loaded.doc)
  if ('error' in r) throw new Error(r.error)
  return { source: loaded.doc, ...r }
}

const paths = (d: Document) =>
  Array.from(d.getElementsByTagName('BehaviorTree')).map((b) => b.getAttribute('_fullpath'))

describe('toLiveShape', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('emits one block per instance', () => {
    const { doc, source } = shaped(xml)
    const main = Array.from(source.getElementsByTagName('BehaviorTree')).find(
      (b) => b.getAttribute('ID') === 'main_bt',
    )!
    expect(main).toBeTruthy()
    // reachable calls counted by walking the source
    const byId = new Map(
      Array.from(source.getElementsByTagName('BehaviorTree')).map((b) => [b.getAttribute('ID')!, b]),
    )
    const count = (bt: Element): number =>
      1 + Array.from(bt.getElementsByTagName('SubTree')).reduce((n, st) => n + count(byId.get(st.getAttribute('ID')!)!), 0)
    expect(paths(doc).length).toBe(count(main))
    expect(paths(doc)[0]).toBe('')
  })

  it('uses name= for a named call', () => {
    expect(paths(shaped(xml).doc)).toContain('walk_the_route')
  })

  it('uses ID::n for an unnamed call, in document order', () => {
    const p = paths(shaped(xml).doc)
    expect(p).toContain('decide::1')
    expect(p.indexOf('decide::1')).toBeLessThan(p.indexOf('decide::2'))
  })

  it('nests paths', () => {
    expect(paths(shaped(xml).doc)).toContain('walk_the_route/actions_at_waypoint')
  })

  it('works with buildInstanceTree', () => {
    const { doc, source } = shaped(xml)
    const mainSrc = Array.from(source.getElementsByTagName('BehaviorTree')).find(
      (b) => b.getAttribute('ID') === 'main_bt',
    )!
    const calls = Array.from(mainSrc.getElementsByTagName('SubTree')).map((s) => s.getAttribute('ID'))
    const root = buildInstanceTree(doc)!
    expect(root.treeId).toBe('main_bt')
    expect(root.path).toBe('')
    expect(root.children.map((c) => c.path)).toContain('walk_the_route')
    expect(root.children.map((c) => c.treeId)).toEqual(calls)
  })

  it('renders in the store', () => {
    const { doc } = shaped(xml)
    const store = useTreeStore()
    store.parseTree(doc)
    expect(store.treeData).not.toBeNull()
    expect(store.selectInstance('walk_the_route')).toBe(true)
  })

  it('maps every uid to a source element of the same tag', () => {
    const { doc, source, sourceIndexByUid } = shaped(xml)
    const all = Array.from(source.getElementsByTagName('*'))
    const withUid = Array.from(doc.getElementsByTagName('*')).filter((e) => e.getAttribute('_uid'))
    expect(withUid.length).toBeGreaterThan(0)
    for (const el of withUid) {
      const idx = sourceIndexByUid[el.getAttribute('_uid')!]
      expect(idx).toBeDefined()
      expect(all[idx].tagName).toBe(el.tagName)
    }
  })

  it('reports recursion as an error', () => {
    const src = `<root BTCPP_format="4" main_tree_to_execute="a"><BehaviorTree ID="a"><SubTree ID="a"/></BehaviorTree></root>`
    const loaded = loadSourceTree(src)
    if ('error' in loaded) throw new Error(loaded.error)
    expect('error' in toLiveShape(loaded.doc)).toBe(true)
  })
})
