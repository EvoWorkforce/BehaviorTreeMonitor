import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/stores/treeStore'
import type { TreeNode } from '@/types'
import xml from '../../../tests/fixtures/aom_fulltree.xml?raw'

function firstSubtree(node: TreeNode): TreeNode | null {
  if (node.isSubtreeContainer) return node
  for (const c of node.children ?? []) {
    const found = firstSubtree(c)
    if (found) return found
  }
  return null
}

describe('parseTree', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('parseTree matches snapshot on aom fixture', () => {
    const store = useTreeStore()
    store.parseTree(xml)
    expect(store.treeData).toMatchSnapshot('horizontal')
    expect(Object.keys(store.nodeStatuses).sort()).toMatchSnapshot('status uids')

    store.toggleLayout()
    expect(store.treeData).toMatchSnapshot('vertical')

    const sub = firstSubtree(store.treeData!)
    expect(sub).not.toBeNull()
    store.toggleSubtree(sub!)
    expect(store.treeData).toMatchSnapshot('first subtree expanded')
  })
})
