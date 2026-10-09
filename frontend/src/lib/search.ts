import type { TreeNode } from '@/types'

/** Nodes whose name, tag or ID contains `query` (case-insensitive), in tree order. */
export function matchNodes(root: TreeNode | null, query: string): TreeNode[] {
  const q = query.trim().toLowerCase()
  if (!root || !q) return []
  const out: TreeNode[] = []
  const walk = (node: TreeNode) => {
    const hay = [node.name, node.tag, node.attributes?.ID ?? '']
    if (hay.some(s => s.toLowerCase().includes(q))) out.push(node)
    node.children?.forEach(walk)
  }
  walk(root)
  return out
}

/** The deepest node whose status is RUNNING; ties go to the first in tree order. */
export function findDeepestRunning(root: TreeNode | null, statuses: Record<string, string>): TreeNode | null {
  let best: TreeNode | null = null
  let bestDepth = -1
  const walk = (node: TreeNode, depth: number) => {
    if (statuses[node.uid] === 'RUNNING' && depth > bestDepth) {
      best = node
      bestDepth = depth
    }
    node.children?.forEach(c => walk(c, depth + 1))
  }
  if (root) walk(root, 0)
  return best
}
