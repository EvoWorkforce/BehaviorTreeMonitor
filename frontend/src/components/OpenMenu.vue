<template>
  <div class="open-menu">
    <button class="btn" aria-haspopup="true" :aria-expanded="open" @click="toggle">Open</button>
    <div v-if="open" class="open-menu-list" role="menu">
      <template v-for="group in groups" :key="group.folder">
        <div class="open-menu-folder" :title="group.folder">{{ group.folder }}</div>
        <button
          v-for="file in group.files"
          :key="file.id"
          class="open-menu-item"
          role="menuitem"
          :title="file.path"
          @click="pick(file)"
        >
          {{ baseName(file.path) }}<span v-if="!file.editable" class="open-menu-tag"> (view only)</span>
        </button>
      </template>
      <div v-if="!groups.length" class="open-menu-empty">No server files</div>
      <button class="open-menu-item open-menu-local" role="menuitem" @click="fileInput?.click()">From this computer…</button>
    </div>
    <input ref="fileInput" type="file" accept=".xml" hidden @change="onLocal" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFileSourceStore } from '../stores/fileSource'
import { groupByFolder, type TreeFileInfo } from '../lib/treeFiles'

const emit = defineEmits<{ (e: 'opened'): void }>()
const src = useFileSourceStore()
const open = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const groups = computed(() => groupByFolder(src.files))

function baseName(path: string) {
  return path.split('/').pop() ?? path
}

async function toggle() {
  open.value = !open.value
  if (open.value) await src.refreshList()
}

async function pick(file: TreeFileInfo) {
  open.value = false
  if (await src.openServerFile(file)) emit('opened')
}

async function onLocal(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  open.value = false
  if (file && (await src.openLocalFile(file))) emit('opened')
  input.value = ''
}
</script>
