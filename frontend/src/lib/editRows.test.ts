import { describe, it, expect } from 'vitest'
import { popoverRows, diffRows } from './editRows'

describe('popoverRows', () => {
  it('hides ID and _ attributes', () => {
    const rows = popoverRows({ ID: 'x', _uid: 'o1', _fullpath: 'a', goal: '{g}' })
    const names = rows.map((r) => r.name)
    expect(names).not.toContain('ID')
    expect(names).not.toContain('_uid')
    expect(names).not.toContain('_fullpath')
    expect(names).toContain('goal')
  })

  it('adds an empty name row', () => {
    const rows = popoverRows({ goal: '{g}' })
    expect(rows.find((r) => r.name === 'name')).toEqual({ name: 'name', value: '', long: false })
  })

  it('does not add a second name row', () => {
    const rows = popoverRows({ name: 'n' })
    expect(rows.filter((r) => r.name === 'name')).toHaveLength(1)
  })

  it('marks long values', () => {
    const rows = popoverRows({ a: 'x'.repeat(61), b: 'x'.repeat(60) })
    expect(rows.find((r) => r.name === 'a')!.long).toBe(true)
    expect(rows.find((r) => r.name === 'b')!.long).toBe(false)
  })
})

describe('diffRows', () => {
  it('returns changed rows only', () => {
    const before = [{ name: 'a', value: '1' }, { name: 'b', value: '2' }]
    const after = [{ name: 'a', value: '1' }, { name: 'b', value: '3' }]
    expect(diffRows(before, after)).toEqual([{ name: 'b', value: '3' }])
  })

  it('treats a name left empty as no edit', () => {
    const before = [{ name: 'name', value: '' }]
    const after = [{ name: 'name', value: '' }]
    expect(diffRows(before, after)).toEqual([])
  })
})
