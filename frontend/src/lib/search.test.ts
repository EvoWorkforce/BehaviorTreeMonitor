import { describe, expect, it } from 'vitest'
import { findDeepestRunning, matchNodes } from '@/lib/search'
import type { TreeNode } from '@/types'

function n(uid: string, name: string, children: TreeNode[] = [], extra: Partial<TreeNode> = {}): TreeNode {
  return {
    tag: 'Action', name, uid, type: 'action', attributes: {}, children,
    x: 0, y: 0, width: 0, depth: 0, subtreeWidth: 0, subtreeHeight: 0, ...extra,
  }
}

const tree = n('1', 'root', [
  n('2', 'Patrol', [n('3', 'GoToWaypoint'), n('4', 'Wait', [], { tag: 'Sleep' })]),
  n('5', 'Other', [], { attributes: { ID: 'goto_helper' } }),
])

describe('matchNodes', () => {
  it('matches name, tag and ID case-insensitively in tree order', () => {
    expect(matchNodes(tree, 'goto').map(m => m.uid)).toEqual(['3', '5'])
    expect(matchNodes(tree, 'SLEEP').map(m => m.uid)).toEqual(['4'])
  })
  it('returns nothing for an empty or blank query', () => {
    expect(matchNodes(tree, '')).toEqual([])
    expect(matchNodes(tree, '  ')).toEqual([])
  })
})

describe('findDeepestRunning', () => {
  it('returns the deepest RUNNING node', () => {
    const st = { '1': 'RUNNING', '2': 'RUNNING', '3': 'RUNNING', '5': 'RUNNING' }
    expect(findDeepestRunning(tree, st)?.uid).toBe('3')
  })
  it('breaks ties by tree order', () => {
    expect(findDeepestRunning(tree, { '3': 'RUNNING', '4': 'RUNNING' })?.uid).toBe('3')
  })
  it('returns null when nothing runs', () => {
    expect(findDeepestRunning(tree, { '1': 'SUCCESS' })).toBeNull()
  })
})
