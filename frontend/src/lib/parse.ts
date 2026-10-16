import type { TreeNode, NodePort, BtNodeType } from '@/types'

// ---- Constants ----
const MIN_NODE_WIDTH = 50
export const NODE_BASE_HEIGHT = 28
export const PORT_HEIGHT = 18
const LEVEL_GAP = 40
const SIBLING_GAP = 8

// ---- Helpers ----
const CJK_RANGE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/

export function measureTextWidth(text: string, charWidth: number): number {
  let w = 0
  for (const ch of text) {
    w += CJK_RANGE.test(ch) ? charWidth * 2 : charWidth
  }
  return w
}

const SKIP_ATTRS = new Set(['ID', '_uid', 'name', '_children_count', '__shared_blackboard'])

export function getNodePorts(node: TreeNode): NodePort[] {
  const ports: NodePort[] = []
  for (const [key, value] of Object.entries(node.attributes)) {
    if (!SKIP_ATTRS.has(key) && !key.startsWith('_')) {
      const isOutput = key.startsWith('OUT:') || key === 'output_key'
      ports.push({ name: key.replace('OUT:', ''), value, isOutput })
    }
  }
  return ports
}

export function getNodeHeight(node: TreeNode): number {
  return NODE_BASE_HEIGHT + getNodePorts(node).length * PORT_HEIGHT
}

function calculateNodeWidth(node: TreeNode): number {
  const ports = getNodePorts(node)
  // Subtree containers also hold the 16px expand button at the right edge, with a gap before it.
  const nameWidth = 22 + measureTextWidth(node.name, 7) + 12 + (node.isSubtreeContainer ? 28 : 0)
  let maxLabelWidth = 0
  let maxValueWidth = 0
  for (const port of ports) {
    const labelWidth = 28 + measureTextWidth(port.name, 6)
    const valueWidth = measureTextWidth(String(port.value || ''), 6) + 8
    maxLabelWidth = Math.max(maxLabelWidth, labelWidth)
    maxValueWidth = Math.max(maxValueWidth, valueWidth)
  }
  const portWidth = ports.length > 0 ? maxLabelWidth + 8 + maxValueWidth + 16 : 0
  return Math.max(MIN_NODE_WIDTH, nameWidth, portWidth)
}

function getNodeType(tagName: string, modelTypes: Record<string, string>): BtNodeType {
  // Prefer the type from TreeNodesModel
  const modelType = modelTypes[tagName]?.toLowerCase()
  if (modelType === 'condition') return 'condition'
  if (modelType === 'action') return 'action'
  if (modelType === 'subtree') return 'subtree'
  if (modelType === 'decorator') return 'decorator'

  const control = ['Sequence', 'ReactiveSequence', 'SequenceWithMemory', 'SequenceStar']
  const fallback = ['Fallback', 'ReactiveFallback', 'FallbackStar']
  const decorators = [
    'Inverter', 'ForceSuccess', 'ForceFailure', 'Repeat',
    'RepeatUntilFailure', 'Retry', 'Timeout', 'Delay',
    'KeepRunningUntilFailure', 'RunOnce',
  ]
  if (tagName === 'Root') return 'root'
  if (control.some(n => tagName.includes(n))) return 'sequence'
  if (fallback.some(n => tagName.includes(n))) return 'fallback'
  if (tagName.includes('Parallel')) return 'parallel'
  if (decorators.some(n => tagName.includes(n))) return 'decorator'
  if (tagName === 'SubTree' || tagName === 'SubTreePlus') return 'subtree'
  if (tagName.includes('Condition') || tagName.includes('Check')) return 'condition'
  return 'action'
}

// ---- Parsing ----
export interface ParseContext {
  modelTypes: Record<string, string>
  /** Registers a node uid with the IDLE status if it has none yet. */
  registerUid: (uid: string) => void
  /** Next generated uid; the counter lives in the context so parses repeat. */
  nextUid: () => string
}

export function createParseContext(
  modelTypes: Record<string, string>,
  registerUid: (uid: string) => void,
): ParseContext {
  let counter = 0
  return { modelTypes, registerUid, nextUid: () => `_gen_${++counter}` }
}

export function parseElement(el: Element, depth: number, ctx: ParseContext): TreeNode | null {
  if (el.nodeType !== 1) return null
  const tag = el.tagName
  if (['root', 'TreeNodesModel', 'include'].includes(tag)) return null

  if (tag === 'BehaviorTree') {
    for (const child of Array.from(el.children)) {
      const parsed = parseElement(child, depth, ctx)
      if (parsed) return parsed
    }
    return null
  }

  const uid = el.getAttribute('_uid') ?? ctx.nextUid()
  const attrs: Record<string, string> = {}
  for (const a of Array.from(el.attributes)) attrs[a.name] = a.value

  if (tag === 'SubTree' || tag === 'SubTreePlus') {
    const subtreeId = el.getAttribute('ID') ?? tag
    const node: TreeNode = {
      tag,
      name: subtreeId,
      uid,
      type: 'subtree',
      attributes: attrs,
      children: [],
      isSubtreeContainer: true,
      subtreeId,
      expanded: false,
      x: 0, y: 0, width: 0, depth, subtreeWidth: 0, subtreeHeight: 0,
    }
    ctx.registerUid(uid)
    return node
  }

  const children: TreeNode[] = []
  for (const child of Array.from(el.children)) {
    const parsed = parseElement(child, depth + 1, ctx)
    if (parsed) children.push(parsed)
  }

  const node: TreeNode = {
    tag,
    name: el.getAttribute('name') ?? el.getAttribute('ID') ?? tag,
    uid,
    type: getNodeType(tag, ctx.modelTypes),
    attributes: attrs,
    children,
    x: 0, y: 0, width: 0, depth, subtreeWidth: 0, subtreeHeight: 0,
  }
  ctx.registerUid(uid)
  return node
}

// ---- Layout ----
function collectLevelInfo(node: TreeNode, depth: number, levelHeights: Record<number, number>, levelWidths: Record<number, number>) {
  node.width = calculateNodeWidth(node)
  node.depth = depth
  const h = getNodeHeight(node)
  if (!levelHeights[depth] || levelHeights[depth] < h) levelHeights[depth] = h
  if (!levelWidths[depth] || levelWidths[depth] < node.width) levelWidths[depth] = node.width
  node.children?.forEach(c => collectLevelInfo(c, depth + 1, levelHeights, levelWidths))
}

function calculateSubtreeWidth(node: TreeNode): number {
  if (!node.children || node.children.length === 0) {
    node.subtreeWidth = node.width
    return node.width
  }
  let total = 0
  node.children.forEach(c => (total += calculateSubtreeWidth(c)))
  total += (node.children.length - 1) * SIBLING_GAP
  node.subtreeWidth = Math.max(node.width, total)
  return node.subtreeWidth
}

function calculateSubtreeHeight(node: TreeNode): number {
  const h = getNodeHeight(node)
  if (!node.children || node.children.length === 0) {
    node.subtreeHeight = h
    return h
  }
  let total = 0
  node.children.forEach(c => (total += calculateSubtreeHeight(c)))
  total += (node.children.length - 1) * SIBLING_GAP
  node.subtreeHeight = Math.max(h, total)
  return node.subtreeHeight
}

function positionNodes(node: TreeNode, centerX: number, levelY: Record<number, number>) {
  node.x = centerX - node.width / 2
  node.y = levelY[node.depth]
  if (!node.children || node.children.length === 0) return
  let totalChildWidth = 0
  node.children.forEach(c => (totalChildWidth += c.subtreeWidth))
  totalChildWidth += (node.children.length - 1) * SIBLING_GAP
  let childCenterX = centerX - totalChildWidth / 2
  node.children.forEach(child => {
    const cc = childCenterX + child.subtreeWidth / 2
    positionNodes(child, cc, levelY)
    childCenterX += child.subtreeWidth + SIBLING_GAP
  })
}

function positionNodesHorizontal(node: TreeNode, centerY: number, levelX: Record<number, number>) {
  node.x = levelX[node.depth]
  node.y = centerY - getNodeHeight(node) / 2
  if (!node.children || node.children.length === 0) return
  let totalChildHeight = 0
  node.children.forEach(c => (totalChildHeight += c.subtreeHeight))
  totalChildHeight += (node.children.length - 1) * SIBLING_GAP
  let childCenterY = centerY - totalChildHeight / 2
  node.children.forEach(child => {
    const cc = childCenterY + child.subtreeHeight / 2
    positionNodesHorizontal(child, cc, levelX)
    childCenterY += child.subtreeHeight + SIBLING_GAP
  })
}

export function layoutTree(root: TreeNode, horizontal: boolean) {
  const levelHeights: Record<number, number> = {}
  const levelWidths: Record<number, number> = {}
  collectLevelInfo(root, 0, levelHeights, levelWidths)
  const maxDepth = Math.max(...Object.keys(levelHeights).map(Number))

  if (horizontal) {
    calculateSubtreeHeight(root)
    const levelX: Record<number, number> = {}
    let currentX = 50
    for (let d = 0; d <= maxDepth; d++) {
      levelX[d] = currentX
      currentX += (levelWidths[d] || MIN_NODE_WIDTH) + LEVEL_GAP
    }
    positionNodesHorizontal(root, 50 + root.subtreeHeight / 2, levelX)
    root.treeWidth = currentX - LEVEL_GAP
    root.treeHeight = root.subtreeHeight
  } else {
    calculateSubtreeWidth(root)
    const levelY: Record<number, number> = {}
    let currentY = 50
    for (let d = 0; d <= maxDepth; d++) {
      levelY[d] = currentY
      currentY += (levelHeights[d] || NODE_BASE_HEIGHT) + LEVEL_GAP
    }
    positionNodes(root, 50 + root.subtreeWidth / 2, levelY)
    root.treeWidth = root.subtreeWidth
    root.treeHeight = currentY - LEVEL_GAP
  }
}
