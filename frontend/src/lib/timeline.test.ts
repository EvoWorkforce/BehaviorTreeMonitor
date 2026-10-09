import { describe, it, expect } from 'vitest'
import { toLanes, capTransitions, exportJson, buildUidPaths } from './timeline'
import type { TransitionRecord } from '@/types'
import xml from '../../../tests/fixtures/aom_fulltree.xml?raw'

const rec = (t: number, uid: number, status: TransitionRecord['status']): TransitionRecord => ({
  timestamp_us: t, uid, status,
})

describe('toLanes', () => {
  const paths = { '1': 'main/Seq', '2': 'main/Go' }

  it('groups by node and keeps time order', () => {
    const lanes = toLanes(
      [rec(10, 1, 'RUNNING'), rec(20, 2, 'RUNNING'), rec(30, 1, 'SUCCESS'), rec(40, 2, 'FAILURE')],
      paths,
    )
    expect(lanes.map(l => l.path)).toEqual(['main/Seq', 'main/Go'])
    expect(lanes[0].events.map(e => e.timestamp_us)).toEqual([10, 30])
    expect(lanes[1].events.map(e => e.timestamp_us)).toEqual([20, 40])
  })

  it('computes the previous status per node', () => {
    const [lane] = toLanes([rec(10, 1, 'RUNNING'), rec(30, 1, 'SUCCESS'), rec(50, 1, 'IDLE')], paths)
    expect(lane.events.map(e => e.prev)).toEqual([null, 'RUNNING', 'SUCCESS'])
  })

  it('sorts out-of-order input', () => {
    const [lane] = toLanes([rec(30, 1, 'SUCCESS'), rec(10, 1, 'RUNNING')], paths)
    expect(lane.events.map(e => e.status)).toEqual(['RUNNING', 'SUCCESS'])
  })

  it('falls back to the uid when the path is unknown', () => {
    const [lane] = toLanes([rec(10, 99, 'RUNNING')], paths)
    expect(lane.path).toBe('uid 99')
  })
})

describe('capTransitions', () => {
  it('drops the oldest records', () => {
    const list = [rec(1, 1, 'IDLE'), rec(2, 1, 'RUNNING'), rec(3, 1, 'SUCCESS')]
    expect(capTransitions(list, 2).map(r => r.timestamp_us)).toEqual([2, 3])
  })
  it('keeps a short list', () => {
    const list = [rec(1, 1, 'IDLE')]
    expect(capTransitions(list, 50000)).toEqual(list)
  })
})

describe('exportJson', () => {
  it('round-trips', () => {
    const list = [rec(1, 1, 'RUNNING'), rec(2, 1, 'SUCCESS')]
    expect(JSON.parse(exportJson(list))).toEqual(list)
  })
})

describe('buildUidPaths', () => {
  it('maps every uid in the fixture, including nodes inside subtree blocks', () => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const map = buildUidPaths(doc)
    const uids = Array.from(doc.querySelectorAll('BehaviorTree [_uid]')).map(e => e.getAttribute('_uid')!)
    expect(uids.length).toBeGreaterThan(5)
    for (const u of uids) expect(map[u]).toBeTruthy()
    const inner = Array.from(doc.querySelectorAll('BehaviorTree[_fullpath="main_patrol_route"] [_uid]'))[0]
    expect(map[inner.getAttribute('_uid')!].path.startsWith('main_patrol_route')).toBe(true)
  })
})
