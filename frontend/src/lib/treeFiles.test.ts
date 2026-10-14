import { describe, it, expect } from 'vitest'
import { groupByFolder, sourceLabel, canvasEmptyText } from './treeFiles'

const f = (id: string, folder: string, name: string, editable = false) => ({
  id,
  path: `${folder}/${name}`,
  folder,
  editable,
})

describe('groupByFolder', () => {
  it('groups by folder and keeps order', () => {
    const groups = groupByFolder([f('1', '/a', 'x.xml'), f('2', '/a', 'y.xml'), f('3', '/b', 'z.xml')])
    expect(groups.map((g) => g.folder)).toEqual(['/a', '/b'])
    expect(groups[0].files.map((x) => x.id)).toEqual(['1', '2'])
    expect(groups[1].files.map((x) => x.id)).toEqual(['3'])
  })
})

describe('sourceLabel', () => {
  const conn = { host: 'localhost', port: 1667, connected: false }
  it('labels the live view', () => {
    expect(sourceLabel('live', conn)).toBe('live localhost:1667')
  })
  it('marks view-only files', () => {
    expect(sourceLabel('file', conn, { name: 'main_bt.xml', editable: false, local: false })).toBe('main_bt.xml (view only)')
    expect(sourceLabel('file', conn, { name: 'main_bt.xml', editable: true, local: true })).toBe('main_bt.xml (view only)')
  })
  it('shows an editable server file plainly', () => {
    expect(sourceLabel('file', conn, { name: 'main_bt.xml', editable: true, local: false })).toBe('main_bt.xml')
  })
})

describe('canvasEmptyText', () => {
  it('live disconnected', () => {
    expect(canvasEmptyText('live', false, false)).toEqual({
      title: 'Not connected to a BT server',
      body: 'Enter the server address and click Connect',
    })
  })
  it('live connected without a tree', () => {
    expect(canvasEmptyText('live', true, false).title).toBe('Waiting for behavior tree data...')
  })
  it('file without a tree', () => {
    expect(canvasEmptyText('file', false, false).title).toBe('Open a tree file')
  })
})
