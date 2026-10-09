import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TransitionRecord } from '@/types'
import { capTransitions, MAX_TRANSITIONS } from '@/lib/timeline'

export const useTimelineStore = defineStore('timeline', () => {
  const records = ref<TransitionRecord[]>([])
  const recording = ref(false)
  /** Epoch time of the recording start; relative times in the log count from here. */
  const startEpochUs = ref(0)

  function setRecording(active: boolean, startUs: number) {
    if (active && !recording.value) records.value = []
    recording.value = active
    startEpochUs.value = startUs
  }

  function add(data: TransitionRecord[]) {
    if (!data.length) return
    records.value = capTransitions([...records.value, ...data], MAX_TRANSITIONS)
  }

  function clear() {
    records.value = []
  }

  return { records, recording, startEpochUs, setRecording, add, clear }
})
