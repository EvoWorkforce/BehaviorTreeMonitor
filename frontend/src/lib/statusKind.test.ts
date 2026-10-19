import { describe, it, expect } from 'vitest'
import { statusKind } from './statusKind'

describe('statusKind', () => {
  it('maps live statuses', () => {
    expect(statusKind('RUNNING')).toBe('running')
    expect(statusKind('SUCCESS')).toBe('success')
    expect(statusKind('FAILURE')).toBe('failure')
  })
  it('treats IDLE_FROM_* and unknown as idle', () => {
    for (const s of ['IDLE', 'IDLE_FROM_SUCCESS', 'IDLE_FROM_FAILURE', 'IDLE_FROM_RUNNING', 'SKIPPED', undefined]) {
      expect(statusKind(s)).toBe('idle')
    }
  })
})
