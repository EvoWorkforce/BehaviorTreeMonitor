import { describe, expect, it } from 'vitest'
import { breadcrumb, buildInstanceTree, subtreeOpenPath } from '@/lib/instances'
import xml from '../../../tests/fixtures/aom_fulltree.xml?raw'

const doc = () => new DOMParser().parseFromString(xml, 'text/xml')

describe('buildInstanceTree', () => {
  it('roots at main_bt with the two route instances', () => {
    const root = buildInstanceTree(doc())!
    expect(root.treeId).toBe('main_bt')
    expect(root.path).toBe('')
    expect(root.subtreeUid).toBeUndefined()
    expect(root.children.map(c => c.path)).toEqual(['main_patrol_route', 'main_base_route'])
    expect(root.children.map(c => c.treeId)).toEqual(['PatrolRoute', 'GoToBaseRoute'])
  })

  it('nests RouteSection and actions_at_waypoint under the patrol route', () => {
    const patrol = buildInstanceTree(doc())!.children[0]
    expect(patrol.subtreeUid).toBe('6')
    expect(patrol.children.map(c => c.path)).toEqual([
      'main_patrol_route/RouteSection::25',
      'main_patrol_route/actions_at_waypoint',
    ])
    expect(patrol.children.map(c => c.treeId)).toEqual(['RouteSection', 'WaypointActions'])
    expect(patrol.children.map(c => c.subtreeUid)).toEqual(['25', '42'])
  })

  it('nests RouteSection under the base route', () => {
    const base = buildInstanceTree(doc())!.children[1]
    expect(base.children.map(c => c.path)).toEqual(['main_base_route/RouteSection::83'])
  })

  it('bbName is path, or treeId for the root', () => {
    const root = buildInstanceTree(doc())!
    expect(root.bbName).toBe('main_bt')
    expect(root.children[0].bbName).toBe('main_patrol_route')
    expect(root.children[0].children[1].bbName).toBe('main_patrol_route/actions_at_waypoint')
  })

  it('ignores <SubTree> entries in TreeNodesModel', () => {
    const all: string[] = []
    const walk = (n: { path: string; treeId: string; children: any[] }) => {
      all.push(n.treeId)
      n.children.forEach(walk)
    }
    walk(buildInstanceTree(doc())!)
    expect(all).not.toContain('SubTree')
    expect(all).toHaveLength(6)
  })

  it('returns null for a document with no BehaviorTree', () => {
    const empty = new DOMParser().parseFromString('<root/>', 'text/xml')
    expect(buildInstanceTree(empty)).toBeNull()
  })
})

describe('breadcrumb', () => {
  it('splits a path into cumulative navigable segments', () => {
    expect(breadcrumb('main_patrol_route/actions_at_waypoint')).toEqual([
      { label: 'main_patrol_route', path: 'main_patrol_route' },
      { label: 'actions_at_waypoint', path: 'main_patrol_route/actions_at_waypoint' },
    ])
  })
  it('is empty for the root', () => {
    expect(breadcrumb('')).toEqual([])
  })
})

describe('subtreeOpenPath', () => {
  const sub = (fullpath?: string) => ({
    isSubtreeContainer: true,
    attributes: (fullpath === undefined ? {} : { _fullpath: fullpath }) as Record<string, string>,
  })

  it('is the _fullpath of a SubTree node that names a known instance', () => {
    const root = buildInstanceTree(doc())
    expect(subtreeOpenPath(sub('main_patrol_route'), root)).toBe('main_patrol_route')
    expect(subtreeOpenPath(sub('main_patrol_route/RouteSection::25'), root)).toBe('main_patrol_route/RouteSection::25')
  })

  it('is null for a non-SubTree node, a missing or unknown path, or no instance tree', () => {
    const root = buildInstanceTree(doc())
    expect(subtreeOpenPath({ isSubtreeContainer: false, attributes: { _fullpath: 'main_patrol_route' } }, root)).toBeNull()
    expect(subtreeOpenPath(sub(), root)).toBeNull()
    expect(subtreeOpenPath(sub('nope'), root)).toBeNull()
    expect(subtreeOpenPath(sub('main_patrol_route'), null)).toBeNull()
  })
})
