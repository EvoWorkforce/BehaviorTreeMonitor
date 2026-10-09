import { reactive, computed } from 'vue'
import type { TreeNode } from '@/types'

const TOOLTIP_SKIP = new Set(['_uid', '_children_count', 'ID'])

/** Hover tooltip for a node: position, node and the attributes worth showing. */
export function useTooltip() {
  const tooltip = reactive<{ visible: boolean; x: number; y: number; node: TreeNode | null }>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  })

  const tooltipAttrs = computed(() => {
    if (!tooltip.node?.attributes) return {} as Record<string, string>
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(tooltip.node.attributes)) {
      if (!TOOLTIP_SKIP.has(k) && !k.startsWith('_')) result[k] = v
    }
    return result
  })

  function showTooltip(event: MouseEvent, node: TreeNode) {
    tooltip.visible = true
    tooltip.x = event.clientX + 15
    tooltip.y = event.clientY + 15
    tooltip.node = node
  }

  function hideTooltip() {
    tooltip.visible = false
  }

  return { tooltip, tooltipAttrs, showTooltip, hideTooltip }
}
