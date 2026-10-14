import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTreeStore, useFileTreeStore } from './treeStore'
import { useViewStore, useActiveTree } from './viewStore'

const xml = (id: string) =>
  `<root BTCPP_format="4" main_tree_to_execute="${id}"><BehaviorTree ID="${id}"><Sequence><Action ID="A"/></Sequence></BehaviorTree></root>`

describe('tree views', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('views are independent', () => {
    const live = useTreeStore()
    const file = useFileTreeStore()
    live.parseTree(xml('live_tree'))
    expect(file.treeData).toBeNull()
    const liveBefore = live.treeData
    file.parseTree(xml('file_tree'))
    expect(live.treeData).toBe(liveBefore)
    expect(live.treeData?.name).toBe('live_tree')
    expect(file.treeData?.name).toBe('file_tree')
  })

  it('live statuses never reach the file view', () => {
    const live = useTreeStore()
    const file = useFileTreeStore()
    live.parseTree(xml('t'))
    file.parseTree(xml('t'))
    live.updateStatus({ some_uid: 'RUNNING' })
    expect(live.nodeStatuses['some_uid']).toBe('RUNNING')
    expect(file.nodeStatuses['some_uid']).toBeUndefined()
  })

  it('active view switches the store', () => {
    const view = useViewStore()
    expect(useActiveTree()).toBe(useTreeStore())
    view.activeView = 'file'
    expect(useActiveTree()).toBe(useFileTreeStore())
  })

  it('live keeps updating while file is active', () => {
    const view = useViewStore()
    view.activeView = 'file'
    useTreeStore().parseTree(xml('still_live'))
    expect(useTreeStore().treeData?.name).toBe('still_live')
  })
})
