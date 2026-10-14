<template>
  <section class="bottom-drawer timeline" aria-label="Timeline">
    <div class="tl-header">
      <span class="tl-title">Timeline</span>
      <button class="btn" :class="tl.recording ? 'btn-danger' : 'btn-primary'" :disabled="!conn.connected" @click="toggleRecord">
        {{ tl.recording ? 'Stop' : 'Record' }}
      </button>
      <button class="btn" :disabled="!tl.records.length" @click="tl.clear()">Clear</button>
      <button class="btn" :disabled="!tl.records.length" @click="onExport">Export JSON</button>
      <span class="tl-count">{{ tl.records.length }} records</span>
      <span class="tl-note">
        Reading transitions clears the runtime buffer for every client. Do not record with Groot2 at the same time.
      </span>
      <PanelClose side="bottom" label="timeline" />
    </div>
    <div v-if="view.activeView === 'file'" class="rail-empty">Offline: no live data</div>
    <div v-else-if="!tl.records.length" class="rail-empty">
      {{ tl.recording ? 'Recording. No transitions yet.' : 'Press Record to capture node status changes.' }}
    </div>
    <div v-else class="tl-body">
      <div class="tl-lanes">
        <div v-for="lane in lanes" :key="lane.uid" class="tl-lane" :title="lane.path" @click="emit('select-node', lane.uid)">
          <span class="tl-lane-name">{{ lane.path }}</span>
          <div class="tl-track">
            <span
              v-for="seg in lane.segments"
              :key="seg.start"
              class="tl-seg"
              :class="seg.cls"
              :style="{ left: seg.left + '%', width: seg.width + '%' }"
            ></span>
          </div>
        </div>
      </div>
      <table class="tl-log">
        <tbody>
          <tr v-for="row in logRows" :key="row.key" @click="emit('select-node', row.uid)">
            <td class="tl-time">{{ row.time }}</td>
            <td class="tl-path">{{ row.path }}</td>
            <td><span class="tl-chg">{{ row.prev }} &rarr; <b :class="row.cls">{{ row.status }}</b></span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import PanelClose from './PanelClose.vue'
import { computed } from 'vue'
import { useTreeStore } from '../stores/treeStore'
import { useViewStore } from '../stores/viewStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useTimelineStore } from '../stores/timelineStore'
import { toLanes, exportJson } from '../lib/timeline'

const props = defineProps<{ send: (msg: Record<string, unknown>) => void }>()
const emit = defineEmits<{ (e: 'select-node', uid: number): void }>()

const store = useTreeStore()
const conn = useConnectionStore()
const view = useViewStore()
const tl = useTimelineStore()

const MAX_LOG_ROWS = 500

function statusClass(s: string): string {
  if (s === 'RUNNING') return 'running'
  if (s === 'SUCCESS') return 'success'
  if (s === 'FAILURE') return 'failure'
  return 'idle'
}

function toggleRecord() {
  props.send({ type: tl.recording ? 'record_stop' : 'record_start' })
}

const pathMap = computed(() => {
  const m: Record<string, string> = {}
  for (const [uid, info] of Object.entries(store.uidInfo)) m[uid] = info.path
  return m
})

const allLanes = computed(() => toLanes(tl.records, pathMap.value))

const range = computed(() => {
  let lo = Infinity
  let hi = -Infinity
  for (const r of tl.records) {
    lo = Math.min(lo, r.timestamp_us)
    hi = Math.max(hi, r.timestamp_us)
  }
  if (tl.startEpochUs > 0 && tl.startEpochUs <= lo) lo = tl.startEpochUs
  return { lo, span: Math.max(hi - lo, 1) }
})

const lanes = computed(() =>
  allLanes.value.map(lane => ({
    uid: lane.uid,
    path: lane.path,
    segments: lane.events.map((e, i) => {
      const end = lane.events[i + 1]?.timestamp_us ?? range.value.lo + range.value.span
      const left = ((e.timestamp_us - range.value.lo) / range.value.span) * 100
      const width = Math.max(((end - e.timestamp_us) / range.value.span) * 100, 0.3)
      return { start: e.timestamp_us, left, width, cls: statusClass(e.status) }
    }),
  })),
)

const logRows = computed(() => {
  const rows = allLanes.value.flatMap(lane =>
    lane.events.map(e => ({
      key: `${lane.uid}-${e.timestamp_us}`,
      ts: e.timestamp_us,
      uid: lane.uid,
      path: lane.path,
      prev: e.prev ?? '-',
      status: e.status,
      cls: statusClass(e.status),
      time: ((e.timestamp_us - range.value.lo) / 1e6).toFixed(3) + ' s',
    })),
  )
  rows.sort((a, b) => a.ts - b.ts)
  return rows.slice(-MAX_LOG_ROWS)
})

function onExport() {
  const blob = new Blob([exportJson(tl.records)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bt-transitions.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
