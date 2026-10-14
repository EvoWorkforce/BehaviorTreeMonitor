import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type { TreeNode } from '@/types'
import {
  createParseContext, layoutTree, parseElement,
  NODE_BASE_HEIGHT, PORT_HEIGHT,
} from '@/lib/parse'
import type { ParseContext } from '@/lib/parse'
import { collectOwnUids } from '@/lib/blackboard'
import { buildInstanceTree } from '@/lib/instances'
import type { InstanceNode } from '@/lib/instances'
import { buildUidPaths } from '@/lib/timeline'
import type { UidInfo } from '@/lib/timeline'

export { measureTextWidth, getNodePorts, getNodeHeight } from '@/lib/parse'

// ---- Store ----
export const useTreeStore = defineStore('tree', () => {
  const horizontal = ref(true)

  const treeData = ref<TreeNode | null>(null)
  const nodeStatuses: Record<string, string> = reactive({})
  const instances = ref<InstanceNode | null>(null)
  const selectedPath = ref('')
  /** Every `_uid` in the FULLTREE -> readable path and owning block, for the timeline. */
  const uidInfo = ref<Record<string, UidInfo>>({})

  /** Uids parsed directly from the selected block; inline-expanded SubTree children are excluded. */
  const ownUids = computed(() => (treeData.value ? collectOwnUids(treeData.value) : new Set<string>()))

  const stats = computed(() => {
    const r = { idle: 0, running: 0, success: 0, failure: 0 }
    for (const s of Object.values(nodeStatuses)) {
      const lower = s.toLowerCase()
      if (lower.includes('running')) r.running++
      else if (lower.includes('success')) r.success++
      else if (lower.includes('failure')) r.failure++
      else r.idle++
    }
    return r
  })

  // XML parsing
  type BehaviorTreeEntry = {
    id: string
    fullpath: string
    element: Element
  }
  const behaviorTreesById: Record<string, BehaviorTreeEntry[]> = {}
  const behaviorTreeEntries: BehaviorTreeEntry[] = []
  let currentModelTypes: Record<string, string> = {}
  let parseCtx: ParseContext | null = null

  function registerUid(uid: string) {
    if (!(uid in nodeStatuses)) nodeStatuses[uid] = 'IDLE'
  }

  function parseTree(source: string | Document) {
    const doc = typeof source === 'string' ? new DOMParser().parseFromString(source, 'text/xml') : source

    // Extract the node type map from TreeNodesModel
    currentModelTypes = {}
    doc.querySelectorAll('TreeNodesModel > *').forEach(el => {
      const id = el.getAttribute('ID')
      if (id) currentModelTypes[id] = el.tagName
    })

    for (const k of Object.keys(behaviorTreesById)) delete behaviorTreesById[k]
    behaviorTreeEntries.length = 0
    doc.querySelectorAll('BehaviorTree').forEach(bt => {
      const id = bt.getAttribute('ID')
      if (!id) return
      const entry: BehaviorTreeEntry = {
        id,
        fullpath: bt.getAttribute('_fullpath') ?? '',
        element: bt,
      }
      behaviorTreeEntries.push(entry)
      if (!behaviorTreesById[id]) behaviorTreesById[id] = []
      behaviorTreesById[id].push(entry)
    })

    const root = doc.querySelector('root')
    const mainId =
      root?.getAttribute('main_tree_to_execute') ??
      root?.querySelector('BehaviorTree')?.getAttribute('ID')
    const mainCandidates = mainId ? (behaviorTreesById[mainId] ?? []) : []
    mainCandidates.sort((a, b) => a.fullpath.length - b.fullpath.length)
    const mainTree = mainCandidates[0]?.element ?? doc.querySelector('BehaviorTree')
    if (!mainTree) return

    // One context per parse; subtree expansion reuses it so generated uids stay unique.
    parseCtx = createParseContext(currentModelTypes, registerUid)

    instances.value = buildInstanceTree(doc)
    uidInfo.value = buildUidPaths(doc)
    selectedPath.value = ''
    renderBlock(mainTree, mainId ?? 'Root')
  }

  // Renders one BehaviorTree block alone as the canvas tree.
  function renderBlock(block: Element, id: string) {
    const ctx = parseCtx ?? createParseContext(currentModelTypes, registerUid)
    const rootUid = block.getAttribute('_uid') ?? `_root_${id}`
    const rootChildren: TreeNode[] = []
    for (const child of Array.from(block.children)) {
      const parsed = parseElement(child, 1, ctx)
      if (parsed) rootChildren.push(parsed)
    }

    const parsedRoot: TreeNode = {
      tag: 'Root',
      name: id,
      uid: rootUid,
      type: 'root',
      attributes: { ID: id },
      children: rootChildren,
      x: 0,
      y: 0,
      width: 0,
      depth: 0,
      subtreeWidth: 0,
      subtreeHeight: 0,
    }
    if (!(rootUid in nodeStatuses)) nodeStatuses[rootUid] = 'IDLE'

    if (rootChildren.length > 0) {
      layoutTree(parsedRoot, horizontal.value)
      treeData.value = parsedRoot
    }
  }

  /** Shows the block at `path` alone ('' is the main tree). Returns false if unknown. */
  function selectInstance(path: string): boolean {
    const entry = behaviorTreeEntries.find(e => e.fullpath === path)
    if (!entry) return false
    selectedPath.value = path
    renderBlock(entry.element, entry.id)
    return true
  }

  function relayout() {
    if (treeData.value) {
      layoutTree(treeData.value, horizontal.value)
      // Trigger a reactive update
      treeData.value = { ...treeData.value }
    }
  }

  function toggleLayout() {
    horizontal.value = !horizontal.value
    relayout()
  }

  function updateStatus(data: Record<string, string>) {
    for (const [uid, status] of Object.entries(data)) {
      nodeStatuses[uid] = status
    }
  }

  function parseSubtreeChildren(el: Element, depth: number): TreeNode[] {
    const ctx = parseCtx ?? createParseContext(currentModelTypes, registerUid)
    const children: TreeNode[] = []
    for (const child of Array.from(el.children)) {
      const parsed = parseElement(child, depth, ctx)
      if (parsed) children.push(parsed)
    }
    return children
  }


  function statusScore(status?: string): number {
    if (!status) return 0
    const s = status.toLowerCase()
    if (s.includes('running')) return 5
    if (s.includes('success') || s.includes('failure')) return 3
    if (s.includes('idle')) return 1
    return 0
  }

  function behaviorTreeScore(btElement: Element): number {
    let score = 0
    for (const el of Array.from(btElement.querySelectorAll('*'))) {
      const uid = el.getAttribute('_uid')
      if (!uid) continue
      score += statusScore(nodeStatuses[uid])
    }
    return score
  }

  // Some runtimes expose subtree instances with suffixed IDs (e.g. MyTree::instance).
  // Prefer the candidate whose node statuses are most active.
  function resolveSubtreeBehaviorTree(subtreeId: string, subtreePath?: string): Element | null {
    let candidates = behaviorTreesById[subtreeId] ?? []

    // Fallback: some runtimes may suffix subtree IDs.
    if (candidates.length === 0) {
      candidates = behaviorTreeEntries.filter(e =>
        e.id === subtreeId || e.id.startsWith(`${subtreeId}::`) || e.id.startsWith(`${subtreeId}/`)
      )
    }

    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0].element

    if (subtreePath) {
      const exactByPath = candidates.find(e => e.fullpath === subtreePath)
      if (exactByPath) return exactByPath.element
    }

    let best = candidates[0]
    let bestScore = behaviorTreeScore(best.element)
    for (const c of candidates.slice(1)) {
      const s = behaviorTreeScore(c.element)
      if (s > bestScore) {
        best = c
        bestScore = s
      }
    }
    return best.element
  }

  function toggleSubtree(node: TreeNode) {
    if (!node.isSubtreeContainer || !node.subtreeId) return

    if (node.expanded) {
      // Collapse: keep status data, clear only the child nodes
      node.children = []
      node.expanded = false
    } else {
      // Expand: parse the child nodes from behaviorTrees
      const subtreePath = node.attributes['_fullpath']
      const btElement = resolveSubtreeBehaviorTree(node.subtreeId, subtreePath)
      if (!btElement) return
      node.children = parseSubtreeChildren(btElement, node.depth + 1)
      node.expanded = true
    }

    relayout()
  }

  return {
    horizontal,
    treeData, ownUids, nodeStatuses, stats, instances, selectedPath, uidInfo,
    parseTree, selectInstance, updateStatus, toggleLayout, toggleSubtree,
    NODE_BASE_HEIGHT,
    PORT_HEIGHT,
  }
})