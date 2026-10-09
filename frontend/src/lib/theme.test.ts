import { describe, it, expect } from 'vitest'
import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('saved value wins over the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('follows the OS when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })
  it('treats a junk saved value as null', () => {
    expect(resolveTheme('purple', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})
