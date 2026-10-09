import { describe, expect, it } from 'vitest'
import {
  bbNameForPath, describeNull, diffBlackboard, extractPortTypes, resolvePortValue,
} from '@/lib/blackboard'
import { buildInstanceTree } from '@/lib/instances'
import xml from '../../../tests/fixtures/aom_fulltree.xml?raw'

describe('diffBlackboard', () => {
  it('reports changed, added and removed keys', () => {
    const d = diffBlackboard({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 })
    expect(d.changed).toEqual(['b'])
    expect(d.added).toEqual(['d'])
    expect(d.removed).toEqual(['c'])
  })

  it('deep-compares objects and arrays', () => {
    const prev = { pose: { x: 1, q: [0, 0, 0, 1] }, list: [1, 2] }
    expect(diffBlackboard(prev, { pose: { x: 1, q: [0, 0, 0, 1] }, list: [1, 2] }).changed).toEqual([])
    expect(diffBlackboard(prev, { pose: { x: 1, q: [0, 0, 1, 1] }, list: [1, 2] }).changed).toEqual(['pose'])
    expect(diffBlackboard(prev, { pose: prev.pose, list: [1, 2, 3] }).changed).toEqual(['list'])
  })

  it('treats a null previous map as empty', () => {
    expect(diffBlackboard(null, { a: 1 }).added).toEqual(['a'])
  })
})

describe('resolvePortValue', () => {
  const bb = { robot_pose: { x: 1 }, n: 0 }
  it('resolves a {key} reference', () => {
    expect(resolvePortValue('{robot_pose}', bb)).toEqual({ x: 1 })
    expect(resolvePortValue('{n}', bb)).toBe(0)
  })
  it('returns undefined for a literal or a missing key', () => {
    expect(resolvePortValue('literal', bb)).toBeUndefined()
    expect(resolvePortValue('{missing}', bb)).toBeUndefined()
    expect(resolvePortValue('{n}', null)).toBeUndefined()
  })
})

describe('describeNull', () => {
  it('names the type when the model knows it', () => {
    expect(describeNull('robot_pose', { robot_pose: 'geometry_msgs::msg::Pose' }))
      .toBe('not exported (geometry_msgs::msg::Pose)')
  })
  it('falls back to the bare text', () => {
    expect(describeNull('x', {})).toBe('not exported')
  })
})

describe('extractPortTypes', () => {
  it('maps blackboard keys to model types without the allocator suffix', () => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const types = extractPortTypes(doc)
    const poseTypes = Object.values(types).filter(t => t.startsWith('geometry_msgs::msg::Pose'))
    expect(poseTypes.length).toBeGreaterThan(0)
    expect(Object.values(types).some(t => t.includes('allocator'))).toBe(false)
  })
})

describe('bbNameForPath', () => {
  const root = buildInstanceTree(new DOMParser().parseFromString(xml, 'text/xml'))!
  it('sends the tree ID for the root, never an empty string', () => {
    expect(bbNameForPath(root, '')).toBe('main_bt')
  })
  it('sends the path for an instance', () => {
    expect(bbNameForPath(root, 'main_patrol_route')).toBe('main_patrol_route')
  })
  it('is null for an unknown path', () => {
    expect(bbNameForPath(root, 'nope')).toBeNull()
  })
})
