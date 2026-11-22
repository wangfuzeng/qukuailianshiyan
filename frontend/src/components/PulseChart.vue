<script setup>
import { computed } from 'vue'

const props = defineProps({
  blocks: { type: Array, default: () => [] },
})

const points = computed(() => {
  const recent = props.blocks.slice(-18)
  if (recent.length < 2) return ''
  const intervals = []
  for (let index = 1; index < recent.length; index += 1) {
    intervals.push(Math.max(0, Number(recent[index].timestamp) - Number(recent[index - 1].timestamp)))
  }
  const max = Math.max(...intervals, 1)
  return intervals.map((interval, index) => {
    const x = (index / (intervals.length - 1)) * 100
    const y = 88 - (interval / max) * 60
    return `${x},${y}`
  }).join(' ')
})

const bars = computed(() => {
  const recent = props.blocks.slice(-16)
  if (recent.length < 2) return []
  const intervals = recent.slice(1).map((block, index) => Math.max(1, Number(block.timestamp) - Number(recent[index].timestamp)))
  const max = Math.max(...intervals, 1)
  return intervals.map((interval, index) => ({
    key: index,
    height: 20 + (interval / max) * 80,
    active: index === intervals.length - 1,
  }))
})
</script>

<template>
  <div class="pulse-chart">
    <div class="pulse-bars" aria-hidden="true">
      <span v-for="bar in bars" :key="bar.key" :style="{ height: `${bar.height}%` }" :class="{ 'is-active': bar.active }"></span>
    </div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="pulse-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d8b777" stop-opacity=".24" />
          <stop offset="1" stop-color="#d8b777" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polyline v-if="points" class="pulse-line" :points="points" />
      <polygon v-if="points" class="pulse-area" :points="`0,100 ${points} 100,100`" />
    </svg>
    <span v-if="!bars.length" class="pulse-empty">等待区块数据</span>
  </div>
</template>
