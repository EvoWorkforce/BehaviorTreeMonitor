<template>
  <aside class="right-rail blackboard-rail" aria-label="Blackboard">
    <div class="rail-title">Blackboard <span class="bb-target">{{ bb.target }}</span> <PanelClose side="right" label="blackboard" /></div>
    <input v-model="bb.filter" class="bb-filter" type="search" placeholder="Filter keys" aria-label="Filter keys" />
    <ul v-if="bb.rows.length" class="bb-list">
      <li v-for="row in bb.rows" :key="row.key" class="bb-row" :class="{ flash: bb.flashing.has(row.key) }">
        <div class="bb-head">
          <button
            class="bb-pin"
            :class="{ on: row.pinned }"
            :title="row.pinned ? 'Unpin' : 'Pin to top'"
            :aria-pressed="row.pinned"
            @click="bb.togglePin(row.key)"
          >{{ row.pinned ? '●' : '○' }}</button>
          <span class="bb-name">{{ row.key }}</span>
        </div>
        <BlackboardValue :value="row.value" :null-text="describeNull(row.key, bb.portTypes)" />
      </li>
    </ul>
    <div v-else class="rail-empty">{{ bb.filter ? 'No matching keys' : 'No values yet' }}</div>
  </aside>
</template>

<script setup lang="ts">
import PanelClose from './PanelClose.vue'
import BlackboardValue from './BlackboardValue.vue'
import { useBlackboardStore } from '@/stores/blackboardStore'
import { describeNull } from '@/lib/blackboard'

const bb = useBlackboardStore()
</script>
