// Tolerant loading of a behaviour-tree source file (offline file view).

/** Replace comment bodies with spaces; length and newline positions are kept. */
export function blankComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const start = source.indexOf('<!--', i)
    if (start < 0) break
    const end = source.indexOf('-->', start + 4)
    if (end < 0) break
    out += source.slice(i, start + 4)
    out += source.slice(start + 4, end).replace(/[^\n]/g, ' ')
    out += '-->'
    i = end + 3
  }
  return out + source.slice(i)
}

export function loadSourceTree(source: string): { doc: Document; includes: string[] } | { error: string } {
  const doc = new DOMParser().parseFromString(blankComments(source), 'text/xml')
  // happy-dom and Chromium both mark a parse error with a <parsererror> element.
  const perr = doc.getElementsByTagName('parsererror')[0]
  if (perr) return { error: `Not well-formed XML: ${(perr.textContent ?? '').trim().slice(0, 200)}` }
  const root = doc.documentElement
  if (!root || root.tagName !== 'root') return { error: 'Not a behaviour tree file: no <root> element' }
  if (root.getAttribute('BTCPP_format') !== '4') {
    return { error: `Unsupported BTCPP_format "${root.getAttribute('BTCPP_format') ?? ''}": only 4 is supported` }
  }
  const includes = Array.from(doc.getElementsByTagName('include')).map((e) => e.getAttribute('path') ?? '')
  return { doc, includes }
}
