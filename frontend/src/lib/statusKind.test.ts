import { describe, it, expect } from 'vitest'
import { statusKind, isFaded } from './statusKind'

describe('statusKind', () => {
  it('maps live statuses', () => {
    expect(statusKind('RUNNING')).toBe('running')
    expect(statusKind('SUCCESS')).toBe('success')
    expect(statusKind('FAILURE')).toBe('failure')
  })
  it('keeps the last result colour for IDLE_FROM_SUCCESS and IDLE_FROM_FAILURE', () => {
    expect(statusKind('IDLE_FROM_SUCCESS')).toBe('success')
    expect(statusKind('IDLE_FROM_FAILURE')).toBe('failure')
    expect(isFaded('IDLE_FROM_SUCCESS')).toBe(true)
    expect(isFaded('SUCCESS')).toBe(false)
  })
  it('treats IDLE_FROM_RUNNING and unknown as idle', () => {
    for (const s of ['IDLE', 'IDLE_FROM_RUNNING', 'SKIPPED', undefined]) {
      expect(statusKind(s)).toBe('idle')
    }
  })
})
