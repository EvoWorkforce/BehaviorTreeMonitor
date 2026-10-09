import { describe, expect, it } from 'vitest'
import { DEFAULT_PANELS, loadPanels, savePanels, shouldHandleShortcut, togglePanel } from './panels'

function el(tag: string, editable = false): HTMLElement {
  const e = document.createElement(tag)
  if (editable) e.setAttribute('contenteditable', 'true')
  return e
}

describe('shouldHandleShortcut', () => {
  it('is false for input, textarea and contenteditable', () => {
    expect(shouldHandleShortcut(el('input'))).toBe(false)
    expect(shouldHandleShortcut(el('textarea'))).toBe(false)
    expect(shouldHandleShortcut(el('div', true))).toBe(false)
  })
  it('is true for other targets and null', () => {
    expect(shouldHandleShortcut(el('div'))).toBe(true)
    expect(shouldHandleShortcut(null)).toBe(true)
  })
})

describe('loadPanels', () => {
  it('survives a throwing storage', () => {
    const bad = {
      getItem() { throw new Error('denied') },
      setItem() { throw new Error('denied') },
    } as unknown as Storage
    expect(loadPanels(bad)).toEqual(DEFAULT_PANELS)
    expect(() => savePanels(bad, DEFAULT_PANELS)).not.toThrow()
  })
  it('ignores junk and round-trips', () => {
    const data: Record<string, string> = { 'btm.panels': '{nope' }
    const s = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v } } as unknown as Storage
    expect(loadPanels(s)).toEqual(DEFAULT_PANELS)
    const p = { ...DEFAULT_PANELS, leftOpen: false, rightWidth: 400 }
    savePanels(s, p)
    expect(loadPanels(s)).toEqual(p)
  })
})

describe('togglePanel', () => {
  it('flips only the named panel and returns a new state', () => {
    const s = { ...DEFAULT_PANELS }
    const left = togglePanel(s, 'left')
    expect(left).not.toBe(s)
    expect(left).toEqual({ ...s, leftOpen: !s.leftOpen })
    expect(togglePanel(s, 'right')).toEqual({ ...s, rightOpen: !s.rightOpen })
    expect(togglePanel(s, 'bottom')).toEqual({ ...s, bottomOpen: !s.bottomOpen })
    expect(s).toEqual(DEFAULT_PANELS)
  })
  it('toggled twice is the original state', () => {
    expect(togglePanel(togglePanel(DEFAULT_PANELS, 'bottom'), 'bottom')).toEqual(DEFAULT_PANELS)
  })
})
