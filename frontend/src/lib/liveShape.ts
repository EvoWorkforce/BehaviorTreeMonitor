// Converts a loaded source document into the "live shape": one <BehaviorTree> block per
// SubTree instance with `_fullpath` and `_uid`, as the runtime's FULLTREE does.

export type LiveShape = { doc: Document; sourceIndexByUid: Record<string, number> }

function copyAttrs(from: Element, to: Element, skip?: string) {
  for (const a of Array.from(from.attributes)) if (a.name !== skip) to.setAttribute(a.name, a.value)
}

function cloneModel(src: Element, out: Document): Element {
  const el = out.createElementNS(null, src.tagName)
  copyAttrs(src, el)
  for (const c of Array.from(src.children)) el.appendChild(cloneModel(c, out))
  return el
}

export function toLiveShape(doc: Document): LiveShape | { error: string } {
  const srcRoot = doc.documentElement
  const blocks = Array.from(doc.getElementsByTagName('BehaviorTree'))
  const byId = new Map<string, Element>()
  for (const b of blocks) {
    const id = b.getAttribute('ID')
    if (id && !byId.has(id)) byId.set(id, b)
  }
  const mainId = srcRoot.getAttribute('main_tree_to_execute') ?? blocks[0]?.getAttribute('ID') ?? ''
  const main = byId.get(mainId)
  if (!main) return { error: `No <BehaviorTree> found for "${mainId}"` }

  const srcIndex = new Map<Element, number>()
  Array.from(doc.getElementsByTagName('*')).forEach((e, i) => srcIndex.set(e, i))

  const out = new DOMParser().parseFromString('<root/>', 'text/xml')
  const outRoot = out.documentElement
  outRoot.setAttribute('main_tree_to_execute', mainId)
  const model = Array.from(srcRoot.children).find((c) => c.tagName === 'TreeNodesModel')
  if (model) outRoot.appendChild(cloneModel(model, out))

  const sourceIndexByUid: Record<string, number> = {}
  let uidCounter = 0
  const counters = new Map<string, number>()
  let error: string | null = null

  const stamp = (el: Element, src: Element) => {
    const uid = `o${++uidCounter}`
    el.setAttribute('_uid', uid)
    sourceIndexByUid[uid] = srcIndex.get(src)!
  }

  const emitNode = (src: Element, parentPath: string, stack: string[]): Element => {
    const el = out.createElementNS(null, src.tagName)
    copyAttrs(src, el, '_uid')
    stamp(el, src)
    if (src.tagName === 'SubTree' && !error) {
      const id = src.getAttribute('ID') ?? ''
      let seg = src.getAttribute('name')
      if (!seg) {
        const n = (counters.get(id) ?? 0) + 1
        counters.set(id, n)
        seg = `${id}::${n}`
      }
      const path = parentPath ? `${parentPath}/${seg}` : seg
      el.setAttribute('_fullpath', path)
      if (stack.includes(id)) {
        error = `Recursive SubTree "${id}" (${[...stack, id].join(' -> ')})`
      } else {
        const target = byId.get(id)
        if (!target) error = `SubTree "${id}" has no <BehaviorTree> definition`
        else emitBlock(target, path, [...stack, id])
      }
    } else {
      for (const c of Array.from(src.children)) el.appendChild(emitNode(c, parentPath, stack))
    }
    return el
  }

  const emitBlock = (src: Element, path: string, stack: string[]) => {
    const block = out.createElementNS(null, 'BehaviorTree')
    copyAttrs(src, block, '_uid')
    block.setAttribute('_fullpath', path)
    stamp(block, src)
    outRoot.appendChild(block)
    for (const c of Array.from(src.children)) block.appendChild(emitNode(c, path, stack))
  }

  emitBlock(main, '', [mainId])
  if (error) return { error }
  return { doc: out, sourceIndexByUid }
}
