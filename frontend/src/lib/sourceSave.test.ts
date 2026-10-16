import { describe, expect, it } from 'vitest'
import { planAttributeSave, type OpenSource } from './sourceSave'

const rootText = '<root><BehaviorTree ID="Main"><Dock goal="a"/></BehaviorTree></root>'
const incText = '<root><BehaviorTree ID="Walk"><Sleep msec="1"/><Dock goal="b"/></BehaviorTree></root>'

const sources: Record<string, OpenSource> = {
  '': { fileKey: '', id: 'root-id', text: rootText, sha256: 'sha-root', editable: true },
  'bt/walk.xml': { fileKey: 'bt/walk.xml', id: 'walk-id', text: incText, sha256: 'sha-walk', editable: true },
  'bt/ro.xml': { fileKey: 'bt/ro.xml', id: 'ro-id', text: incText, sha256: 'sha-ro', editable: false },
}

describe('planAttributeSave', () => {
  it('targets the included file that defines the node', () => {
    // element indices: 0 root, 1 BehaviorTree, 2 Sleep, 3 Dock
    const plan = planAttributeSave('u1', [{ name: 'goal', value: 'z' }], { u1: 'bt/walk.xml' }, { u1: 3 }, sources)
    expect(plan).toEqual({ id: 'walk-id', text: incText.replace('goal="b"', 'goal="z"'), baseSha256: 'sha-walk' })
  })

  it('targets the root for a root node', () => {
    const plan = planAttributeSave('u1', [{ name: 'goal', value: 'z' }], { u1: '' }, { u1: 2 }, sources)
    expect(plan).toEqual({ id: 'root-id', text: rootText.replace('goal="a"', 'goal="z"'), baseSha256: 'sha-root' })
  })

  it('refuses a file that is not editable', () => {
    const plan = planAttributeSave('u1', [{ name: 'goal', value: 'z' }], { u1: 'bt/ro.xml' }, { u1: 3 }, sources)
    expect(plan).toEqual({ error: 'This file is outside the edit folders, so it is view only.' })
  })

  it('refuses an unknown uid', () => {
    const plan = planAttributeSave('nope', [{ name: 'goal', value: 'z' }], {}, {}, sources)
    expect(plan).toEqual({ error: 'This node has no place in the file.' })
  })
})
