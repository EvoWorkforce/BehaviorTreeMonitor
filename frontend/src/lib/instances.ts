/** One BehaviorTree block as the runtime instantiated it. */
export interface InstanceNode {
  /** `_fullpath` of the block; empty for the root. */
  path: string
  /** `ID` of the block. */
  treeId: string
  /** Name to send in a BLACKBOARD request: `path`, or `treeId` for the root. */
  bbName: string
  /** `_uid` of the SubTree node that instantiates this block; the root has none. */
  subtreeUid?: string
  children: InstanceNode[]
}

export interface BreadcrumbSegment {
  label: string
  path: string
}

/**
 * Builds the instance tree from a FULLTREE document. Only `<SubTree>` nodes inside
 * a `<BehaviorTree>` block count; entries in `<TreeNodesModel>` are ignored.
 */
export function buildInstanceTree(doc: Document): InstanceNode | null {
  const blocks = Array.from(doc.querySelectorAll('BehaviorTree'))
  if (blocks.length === 0) return null

  const byPath = new Map<string, Element>()
  for (const b of blocks) byPath.set(b.getAttribute('_fullpath') ?? '', b)

  const rootEl = doc.querySelector('root')
  const mainId = rootEl?.getAttribute('main_tree_to_execute')
  const main =
    (mainId ? blocks.find(b => b.getAttribute('ID') === mainId && !b.getAttribute('_fullpath')) : undefined) ??
    byPath.get('') ??
    blocks[0]

  const build = (block: Element, subtreeUid: string | undefined, seen: Set<Element>): InstanceNode => {
    const path = block.getAttribute('_fullpath') ?? ''
    const treeId = block.getAttribute('ID') ?? ''
    const node: InstanceNode = { path, treeId, bbName: path || treeId, subtreeUid, children: [] }
    if (seen.has(block)) return node
    const next = new Set(seen).add(block)
    for (const st of Array.from(block.querySelectorAll('SubTree, SubTreePlus'))) {
      const childPath = st.getAttribute('_fullpath')
      const child = childPath ? byPath.get(childPath) : undefined
      if (!child) continue
      node.children.push(build(child, st.getAttribute('_uid') ?? undefined, next))
    }
    return node
  }
  return build(main, undefined, new Set())
}

/** Splits an instance path into cumulative segments; the root (empty path) has none. */
export function breadcrumb(path: string): BreadcrumbSegment[] {
  if (!path) return []
  const parts = path.split('/')
  return parts.map((label, i) => ({ label, path: parts.slice(0, i + 1).join('/') }))
}

/**
 * The instance path to open when a SubTree node's name is clicked: its `_fullpath`, if the node is a
 * SubTree container and that path is an instance in `root`; otherwise null.
 */
export function subtreeOpenPath(
  node: { isSubtreeContainer?: boolean; attributes: Record<string, string> },
  root: InstanceNode | null,
): string | null {
  const path = node.isSubtreeContainer ? node.attributes['_fullpath'] : undefined
  if (!path || !root) return null
  const has = (n: InstanceNode): boolean => n.path === path || n.children.some(has)
  return has(root) ? path : null
}
