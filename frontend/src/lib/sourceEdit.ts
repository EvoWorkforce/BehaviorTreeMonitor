// Byte-exact attribute edits on behaviour-tree source text (offline file view).

export interface SourceAttr {
  name: string
  valueStart: number
  valueEnd: number
  quote: '"' | "'"
}

export interface SourceElement {
  tag: string
  start: number
  nameEnd: number
  selfClosing: boolean
  attrs: SourceAttr[]
}

export interface AttributeEdit {
  elementIndex: number
  name: string
  value: string
}

const WS = /\s/

/** Elements in document order; skips comments, CDATA, processing instructions, doctype and end tags. */
export function scanElements(source: string): SourceElement[] {
  const out: SourceElement[] = []
  let i = 0
  const n = source.length
  while (i < n) {
    const lt = source.indexOf('<', i)
    if (lt < 0) break
    if (source.startsWith('<!--', lt)) {
      const e = source.indexOf('-->', lt + 4)
      i = e < 0 ? n : e + 3
    } else if (source.startsWith('<![CDATA[', lt)) {
      const e = source.indexOf(']]>', lt + 9)
      i = e < 0 ? n : e + 3
    } else if (source.startsWith('<?', lt)) {
      const e = source.indexOf('?>', lt + 2)
      i = e < 0 ? n : e + 2
    } else if (source.startsWith('<!', lt) || source.startsWith('</', lt)) {
      const e = source.indexOf('>', lt + 2)
      i = e < 0 ? n : e + 1
    } else {
      let p = lt + 1
      while (p < n && !WS.test(source[p]) && source[p] !== '>' && source[p] !== '/') p++
      const el: SourceElement = { tag: source.slice(lt + 1, p), start: lt, nameEnd: p, selfClosing: false, attrs: [] }
      while (p < n) {
        while (p < n && WS.test(source[p])) p++
        const c = source[p]
        if (c === '>') { p++; break }
        if (c === '/') { el.selfClosing = true; p = source[p + 1] === '>' ? p + 2 : p + 1; break }
        const ns = p
        while (p < n && !WS.test(source[p]) && source[p] !== '=' && source[p] !== '>' && source[p] !== '/') p++
        const name = source.slice(ns, p)
        while (p < n && WS.test(source[p])) p++
        if (source[p] !== '=') continue
        p++
        while (p < n && WS.test(source[p])) p++
        const q = source[p]
        if (q !== '"' && q !== "'") continue
        const vs = p + 1
        const ve = source.indexOf(q, vs)
        if (ve < 0) { p = n; break }
        el.attrs.push({ name, valueStart: vs, valueEnd: ve, quote: q })
        p = ve + 1
      }
      out.push(el)
      i = p
    }
  }
  return out
}

export function escapeAttr(value: string, quote: '"' | "'"): string {
  const q = quote === '"' ? '&quot;' : '&apos;'
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split(quote).join(q)
}

// After the last existing attribute, else right after the tag name.
const insertAt = (el: SourceElement): number =>
  el.attrs.length ? el.attrs[el.attrs.length - 1].valueEnd + 1 : el.nameEnd

/** Patch attribute values in place; a missing attribute is inserted as ` name="…"` after the last attribute. */
export function applyAttributeEdits(source: string, edits: AttributeEdit[]): string {
  const els = scanElements(source)
  const ops = edits.map((e, seq) => {
    const el = els[e.elementIndex]
    if (!el) throw new Error(`No element at index ${e.elementIndex}`)
    const attr = el.attrs.find((a) => a.name === e.name)
    return attr
      ? { start: attr.valueStart, end: attr.valueEnd, text: escapeAttr(e.value, attr.quote), seq }
      : { start: insertAt(el), end: insertAt(el), text: ` ${e.name}="${escapeAttr(e.value, '"')}"`, seq }
  })
  // Highest offset first so earlier offsets stay valid; ties in reverse list order keep list order.
  ops.sort((a, b) => b.start - a.start || b.seq - a.seq)
  let out = source
  for (const op of ops) out = out.slice(0, op.start) + op.text + out.slice(op.end)
  return out
}
