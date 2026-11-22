<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  activities: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const filters = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '写入' },
  { key: 'sync', label: '同步' },
  { key: 'peer', label: '节点' },
]
const activeFilter = ref('all')

const visibleActivities = computed(() => {
  if (activeFilter.value === 'all') return props.activities
  return props.activities.filter((item) => item.type === activeFilter.value)
})

const iconFor = (type) => {
  if (type === 'mine') return 'pickaxe'
  if (type === 'sync') return 'refresh'
  if (type === 'peer') return 'node'
  if (type === 'error') return 'alert'
  return 'shield'
}

const timeLabel = (value) => {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

const detailLabel = (activity) => {
  const detail = activity.detail || {}
  const parts = []
  if (detail.blockIndex != null) parts.push(`区块 #${detail.blockIndex}`)
  if (detail.peer) parts.push(detail.peer)
  if (detail.source) parts.push(detail.source)
  return parts.join(' · ')
}
</script>

<template>
  <section class="panel activity-panel">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">EVENT STREAM</span>
        <h2>实时活动</h2>
      </div>
      <AppIcon name="activity" :size="19" class="panel-heading__icon" />
    </div>

    <div class="activity-filters">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === filter.key }"
        @click="activeFilter = filter.key"
      >
        {{ filter.label }}
      </button>
    </div>

    <div v-if="loading" class="activity-empty">
      <span class="mini-spinner"></span>正在读取活动记录
    </div>
    <ol v-else-if="visibleActivities.length" class="activity-list">
      <li v-for="activity in visibleActivities" :key="activity.id" :class="`activity-item activity-item--${activity.type}`">
        <span class="activity-item__icon"><AppIcon :name="iconFor(activity.type)" :size="15" /></span>
        <div class="activity-item__body">
          <strong>{{ activity.title }}</strong>
          <span>{{ detailLabel(activity) || '节点状态更新' }}</span>
        </div>
        <time>{{ timeLabel(activity.at) }}</time>
      </li>
    </ol>
    <div v-else class="activity-empty">
      <AppIcon name="activity" :size="21" />
      <span>{{ activities.length ? '当前筛选下没有活动' : '等待节点操作，事件会实时出现在这里' }}</span>
    </div>
  </section>
</template>
