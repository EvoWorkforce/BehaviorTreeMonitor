import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTreeStore, useFileTreeStore } from './treeStore'

/** Which tree view the canvas, rail and toolbar show. */
export const useViewStore = defineStore('view', () => {
  const activeView = ref<'live' | 'file'>('live')
  return { activeView }
})

/** The tree store of the active view. */
export function useActiveTree() {
  return useViewStore().activeView === 'file' ? useFileTreeStore() : useTreeStore()
}
