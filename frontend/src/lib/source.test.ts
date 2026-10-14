import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { blankComments, loadSourceTree } from './source'

const fixture = readFileSync(resolve(__dirname, '__fixtures__/main_bt.source.xml'), 'utf8')

describe('happy-dom characterisation', () => {
  it('characterises happy-dom on malformed XML', () => {
    // Signal chosen for loadSourceTree: a <parsererror> element somewhere in the document.
    // happy-dom keeps documentElement as <root> for an unclosed tag, so the absence of
    // <root> is not a reliable signal; parsererror is.
    const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml')
    expect(parse('<root><a></root>').getElementsByTagName('parsererror').length).toBeGreaterThan(0)
    expect(parse('not xml').getElementsByTagName('parsererror').length).toBeGreaterThan(0)
    expect(parse('<root><a/></root>').getElementsByTagName('parsererror').length).toBe(0)
    // happy-dom accepts a "--" inside a comment, which a strict parser rejects.
    expect(parse('<root><!-- a -- b --></root>').getElementsByTagName('parsererror').length).toBe(0)
  })
})

describe('blankComments', () => {
  it('keeps length and newlines', () => {
    const src = '<a>\n<!-- one\ntwo -->\n<b/>\n</a>\n'
    const out = blankComments(src)
    expect(out.length).toBe(src.length)
    const nl = (s: string) => [...s].flatMap((c, i) => (c === '\n' ? [i] : []))
    expect(nl(out)).toEqual(nl(src))
  })

  it('blanks a comment containing -- and <', () => {
    const src = '<a><!-- x -- <y> --><b/></a>'
    const out = blankComments(src)
    expect(out.slice(0, 7)).toBe('<a><!--')
    expect(out.slice(7, 17)).toBe(' '.repeat(10))
    expect(out.slice(17)).toBe('--><b/></a>')
    expect(out.slice(0, 7) + out.slice(17)).toBe(src.slice(0, 7) + src.slice(17))
  })
})

describe('loadSourceTree', () => {
  it('loads main_bt.source.xml', () => {
    const r = loadSourceTree(fixture)
    if ('error' in r) throw new Error(r.error)
    expect(r.doc.getElementsByTagName('BehaviorTree').length).toBe(5)
    expect(r.doc.documentElement.getAttribute('main_tree_to_execute')).toBe('main_bt')
    expect(r.includes).toEqual([])
  })

  it('loads a file whose comment contains --', () => {
    const r = loadSourceTree(
      '<root BTCPP_format="4"><!-- a -- b --><BehaviorTree ID="t"><Sequence/></BehaviorTree></root>',
    )
    expect('error' in r).toBe(false)
  })

  it('reports malformed XML', () => {
    const r = loadSourceTree('<root BTCPP_format="4"><BehaviorTree ID="t"></root>')
    expect('error' in r && r.error.length > 0).toBe(true)
  })

  it('rejects a non-v4 file', () => {
    const r = loadSourceTree('<root BTCPP_format="3"><BehaviorTree ID="t"/></root>')
    expect('error' in r && r.error).toContain('BTCPP_format')
  })

  it('lists skipped includes', () => {
    const r = loadSourceTree(
      '<root BTCPP_format="4"><include path="a.xml"/><BehaviorTree ID="t"/></root>',
    )
    if ('error' in r) throw new Error(r.error)
    expect(r.includes).toEqual(['a.xml'])
  })
})
