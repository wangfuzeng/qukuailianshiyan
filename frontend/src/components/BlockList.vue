<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  blocks: { type: Array, default: () => [] },
  searchQuery: { type: String, default: '' },
  copiedKey: { type: String, default: '' },
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['copy', 'open'])

const newestFirst = computed(() => [...props.blocks].reverse())
const latestHash = computed(() => props.blocks.at(-1)?.hash)
const matches = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  if (!query) return newestFirst.value
  return newestFirst.value.filter((block) => {
    return `${block.index} ${block.data} ${block.hash} ${block.previousHash}`
      .toLowerCase()
      .includes(query)
  })
})
const visibleBlocks = computed(() => props.expanded ? matches.value : matches.value.slice(0, 8))
const hiddenCount = computed(() => Math.max(0, matches.value.length - visibleBlocks.value.length))

const shortTime = (timestamp) => {
  const date = new Date(Number(timestamp))
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

const relativeTime = (block) => {
  if (block.index === 0) return '链的起点'
  const diff = Date.now() - Number(block.timestamp)
  if (!Number.isFinite(diff) || diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

const copy = (value, key) => {
  if (value != null) emit('copy', String(value), key)
}
</script>

<template>
  <div v-if="visibleBlocks.length" class="block-timeline">
    <article
      v-for="block in visibleBlocks"
      :key="block.hash"
      class="block-card"
      :class="{ 'block-card--latest': block.hash === latestHash }"
      @click="emit('open', block)"
      @keydown.enter="emit('open', block)"
      tabindex="0"
    >
      <div class="block-card__rail">
        <span class="block-node"><AppIcon name="cube" :size="17" /></span>
        <span class="block-rail"></span>
      </div>

      <div class="block-card__body">
        <header class="block-card__header">
          <div class="block-title">
            <span class="block-index">#{{ block.index }}</span>
            <span v-if="block.hash === latestHash" class="latest-badge">最新区块</span>
            <span class="block-type">{{ block.index === 0 ? '创世区块' : '已确认' }}</span>
          </div>
          <span class="block-time" :title="shortTime(block.timestamp)">
            <AppIcon name="clock" :size="14" />
            {{ relativeTime(block) }}
          </span>
          <AppIcon name="chevron" :size="15" class="block-open-icon" />
        </header>

        <div class="block-data">
          <span class="block-data__label">BLOCK DATA</span>
          <p>{{ block.data }}</p>
        </div>

        <div class="block-hashes">
          <button
            type="button"
            class="hash-row"
            title="复制区块哈希"
            @click.stop="copy(block.hash, `hash-${block.index}`)"
          >
            <span class="hash-row__label">HASH</span>
            <code>{{ block.hash }}</code>
            <span class="hash-row__action">
              <AppIcon :name="copiedKey === `hash-${block.index}` ? 'check' : 'copy'" :size="14" />
            </span>
          </button>
          <button
            type="button"
            class="hash-row hash-row--muted"
            title="复制前序哈希"
            @click.stop="copy(block.previousHash, `previous-${block.index}`)"
          >
            <span class="hash-row__label">PREV</span>
            <code>{{ block.previousHash }}</code>
            <span class="hash-row__action">
              <AppIcon :name="copiedKey === `previous-${block.index}` ? 'check' : 'copy'" :size="14" />
            </span>
          </button>
        </div>

        <footer class="block-meta">
          <span><b>NONCE</b>{{ block.nonce }}</span>
          <span><b>TIME</b>{{ shortTime(block.timestamp) }}</span>
        </footer>
      </div>
    </article>
  </div>
  <div v-if="hiddenCount" class="ledger-more-wrap">
    <span>还有 {{ hiddenCount }} 个区块未展示</span>
  </div>
  <div v-if="!visibleBlocks.length" class="empty-state">
    <AppIcon :name="searchQuery ? 'search' : 'blocks'" :size="28" />
    <strong>{{ searchQuery ? '没有匹配的区块' : '链上还没有区块' }}</strong>
    <p>{{ searchQuery ? '尝试其他索引、哈希或区块内容。' : '后端写入数据后会自动出现在这里。' }}</p>
  </div>
</template>
