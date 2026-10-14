import { describe, it, expect } from 'vitest'
import { scanElements, escapeAttr, applyAttributeEdits } from './sourceEdit'
import fixture from './__fixtures__/main_bt.source.xml?raw'

const doc = (s: string) => new DOMParser().parseFromString(s, 'text/xml')

describe('scanElements', () => {
  it('element order equals DOM order', () => {
    const els = scanElements(fixture)
    const dom = Array.from(doc(fixture).getElementsByTagName('*'))
    expect(els.length).toBe(dom.length)
    for (let i = 0; i < dom.length; i++) expect(els[i].tag).toBe(dom[i].tagName)
  })

  it('comment with -- and < is skipped', () => {
    const src = '<root><!-- a -- <Fake x="1"/> b --><A/><B/></root>'
    expect(scanElements(src).map((e) => e.tag)).toEqual(['root', 'A', 'B'])
  })

  it('skips CDATA, processing instructions and end tags', () => {
    const src = '<?xml version="1.0"?><root><![CDATA[<X/>]]><A></A></root>'
    expect(scanElements(src).map((e) => e.tag)).toEqual(['root', 'A'])
  })
})

describe('escapeAttr', () => {
  it('escapes & < > and the quote', () => {
    expect(escapeAttr('a & b < c > d', '"')).toBe('a &amp; b &lt; c &gt; d')
    expect(escapeAttr(`say "hi" 'x'`, '"')).toBe('say &quot;hi&quot; \'x\'')
    expect(escapeAttr(`say "hi" 'x'`, "'")).toBe('say "hi" &apos;x&apos;')
  })
})

describe('applyAttributeEdits', () => {
  const indexOf = (src: string, tag: string, nth = 0) =>
    scanElements(src)
      .map((e, i) => [e.tag, i] as const)
      .filter(([t]) => t === tag)[nth][1]

  it('changes one value only', () => {
    const src = '<root><A x="1" y="2"/></root>'
    const out = applyAttributeEdits(src, [{ elementIndex: 1, name: 'y', value: '3' }])
    expect(out).toBe('<root><A x="1" y="3"/></root>')
  })

  it('keeps the quote character', () => {
    const out = applyAttributeEdits("<root><A x='1'/></root>", [{ elementIndex: 1, name: 'x', value: 'a"b' }])
    expect(out).toBe("<root><A x='a\"b'/></root>")
  })

  it('escapes & < > in the written value', () => {
    const out = applyAttributeEdits('<root><A x="1"/></root>', [{ elementIndex: 1, name: 'x', value: 'a & b < c' }])
    expect(out).toBe('<root><A x="a &amp; b &lt; c"/></root>')
  })

  it('keeps existing entities untouched elsewhere', () => {
    const i = indexOf(fixture, 'SubTree', 0)
    const out = applyAttributeEdits(fixture, [{ elementIndex: i, name: 'name', value: 'zz' }])
    const entityLines = (s: string) => s.split('\n').filter((l) => /&[a-z]+;/.test(l))
    expect(entityLines(out)).toEqual(entityLines(fixture))
    expect(entityLines(fixture).length).toBe(7)
  })

  it('inserts name=', () => {
    const out = applyAttributeEdits('<root><SubTree ID="decide"/></root>', [{ elementIndex: 1, name: 'name', value: 'x' }])
    expect(out).toBe('<root><SubTree ID="decide" name="x"/></root>')
  })

  it('edits an attribute on a later line of a multi-line start tag in place', () => {
    const src = fixture
    const i = scanElements(src).findIndex((e) => e.tag === 'SubTree' && src.slice(e.start, e.start + 60).includes('walk_the_route'))
    const out = applyAttributeEdits(src, [{ elementIndex: i, name: 'heading_home', value: '{other}' }])
    const a = src.split('\n')
    const b = out.split('\n')
    expect(b.length).toBe(a.length)
    const diff = a.map((_l, k) => k).filter((k) => a[k] !== b[k])
    expect(diff.length).toBe(1)
    expect(b[diff[0]]).toBe(a[diff[0]].replace('{walk_heading_home}', '{other}'))
  })

  it('changes only inside the value span', () => {
    const src = fixture
    const i = indexOf(src, 'SubTree', 1)
    const el = scanElements(src)[i]
    const a = el.attrs.find((x) => x.name === 'ID')!
    const out = applyAttributeEdits(src, [{ elementIndex: i, name: 'ID', value: 'QQ' }])
    expect(out.slice(0, a.valueStart)).toBe(src.slice(0, a.valueStart))
    expect(out.endsWith(src.slice(a.valueEnd))).toBe(true)
  })

  it('applies several edits in one call', () => {
    const src = '<root><A x="1"/><B y="2"/></root>'
    const out = applyAttributeEdits(src, [
      { elementIndex: 1, name: 'x', value: 'longer value' },
      { elementIndex: 2, name: 'z', value: 'n' },
      { elementIndex: 2, name: 'y', value: '' },
    ])
    expect(out).toBe('<root><A x="longer value"/><B y="" z="n"/></root>')
  })
})
