<template>
  <div ref="root" class="edit-popover" role="dialog" aria-label="Edit node" :style="pos">
    <div class="edit-title">{{ target.node.tag }} <span class="edit-id">{{ target.node.attributes.ID ?? '' }}</span></div>
    <p v-if="reason" class="edit-reason">{{ reason }}</p>
    <div class="edit-body">
      <label v-for="row in rows" :key="row.name" class="edit-row">
        <span class="edit-label">{{ row.name }}</span>
        <textarea
          v-if="row.long"
          v-model="values[row.name]"
          :disabled="!!reason"
          rows="1"
          @input="grow"
        ></textarea>
        <input v-else v-model="values[row.name]" type="text" :disabled="!!reason" />
      </label>
    </div>
    <p v-if="message" class="edit-message" role="status">{{ message }}</p>
    <div class="edit-actions">
      <button v-if="conflict" class="btn" @click="onReload">Reload</button>
      <button class="btn btn-primary" :disabled="!!reason || saving || !changes.length" @click="onSave">Save</button>
      <button class="btn" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useFileSourceStore } from '../stores/fileSource'
import { diffRows, popoverRows } from '../lib/editRows'

const src = useFileSourceStore()
const target = computed(() => src.editTarget!)
const rows = popoverRows(target.value.node.attributes)
const values = reactive<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.name, r.value])))
const changes = computed(() => diffRows(rows, rows.map((r) => ({ name: r.name, value: values[r.name] ?? '' }))))
const reason = computed(() => src.readOnlyReason())
const message = ref('')
const conflict = ref(false)
const saving = ref(false)
const root = ref<HTMLElement | null>(null)

watch(changes, (c) => { src.dirty = c.length > 0 }, { immediate: true })

const pos = computed(() => {
  const r = target.value.rect
  const left = Math.max(8, Math.min(r.left, window.innerWidth - 340))
  const top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 120))
  return { left: left + 'px', top: top + 'px' }
})

function grow(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function cancel() {
  if (changes.value.length && !window.confirm('Discard the unsaved edits?')) return
  src.closeEditor()
}

async function onSave() {
  saving.value = true
  message.value = ''
  const res = await src.saveEdits(target.value.node.uid, changes.value)
  saving.value = false
  // On success the file reloads and closes this popover; the "Saved" notice shows in the file view.
  if (!res.ok) {
    message.value = res.message
    conflict.value = !!res.conflict
  }
}

async function onReload() {
  if (await src.reload()) src.closeEditor()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') cancel()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.edit-popover {
  position: fixed;
  z-index: 30;
  width: 320px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  color: var(--text-primary);
  font-size: 12px;
}
.edit-title { font-weight: 600; margin-bottom: 6px; }
.edit-id { color: var(--text-muted); font-weight: 400; }
.edit-reason, .edit-message { margin: 0 0 6px; color: var(--text-muted); }
.edit-body { max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.edit-row { display: flex; flex-direction: column; gap: 2px; }
.edit-label { color: var(--text-muted); }
.edit-row input, .edit-row textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 3px 5px;
  font: inherit;
  resize: none;
}
.edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
</style>
