<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  block: { type: Object, default: null },
  blocks: { type: Array, default: () => [] },
  copyingKey: { type: String, default: '' },
})

const emit = defineEmits(['close', 'select', 'copy'])
const index = computed(() => props.block ? props.blocks.findIndex((item) => item.hash === props.block.hash) : -1)
const previous = computed(() => index.value > 0 ? props.blocks[index.value - 1] : null)
const next = computed(() => index.value >= 0 && index.value < props.blocks.length - 1 ? props.blocks[index.value + 1] : null)
const checked = computed(() => props.block?.index > 0)

const formattedTime = computed(() => {
  if (!props.block) return ''
  const date = new Date(Number(props.block.timestamp))
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date)
})
</script>

<template>
  <Transition name="drawer">
    <aside v-if="block" class="detail-drawer" role="dialog" aria-modal="true" aria-label="区块详情">
      <header class="detail-header">
        <div>
          <span class="eyebrow">BLOCK FORENSICS</span>
          <h2>区块 #{{ block.index }}</h2>
        </div>
        <button type="button" class="icon-button" aria-label="关闭区块详情" @click="emit('close')">
          <AppIcon name="close" :size="18" />
        </button>
      </header>

      <div class="detail-status">
        <span class="integrity-badge">{{ block.index === 0 ? '创世区块' : '哈希已复算' }}</span>
        <span class="detail-time">{{ formattedTime }}</span>
      </div>

      <section class="detail-data">
        <span class="detail-label">BLOCK DATA</span>
        <p>{{ block.data }}</p>
      </section>

      <section class="detail-fields">
        <button type="button" class="detail-field" @click="emit('copy', block.hash, 'drawer-hash')">
          <span>HASH</span>
          <code>{{ block.hash }}</code>
          <AppIcon :name="copyingKey === 'drawer-hash' ? 'check' : 'copy'" :size="14" />
        </button>
        <button type="button" class="detail-field" @click="emit('copy', block.previousHash, 'drawer-prev')">
          <span>PREVIOUS HASH</span>
          <code>{{ block.previousHash }}</code>
          <AppIcon :name="copyingKey === 'drawer-prev' ? 'check' : 'copy'" :size="14" />
        </button>
        <div class="detail-field detail-field--static"><span>NONCE</span><code>{{ block.nonce }}</code></div>
        <div class="detail-field detail-field--static"><span>TIMESTAMP</span><code>{{ block.timestamp }}</code></div>
      </section>

      <section class="detail-integrity">
        <AppIcon :name="block.index === 0 ? 'info' : 'checkCircle'" :size="17" />
        <div>
          <strong>{{ block.index === 0 ? '创世区块为链的固定起点' : `浏览器已完成 #${block.index} 哈希复算` }}</strong>
          <span>{{ block.index === 0 ? '其哈希固定，不参与当前公式复算' : '前序引用与区块内容来自后端原始响应' }}</span>
        </div>
      </section>

      <footer class="detail-navigation">
        <button type="button" class="button button--ghost button--small" :disabled="!previous" @click="emit('select', previous)">
          <AppIcon name="arrowLeft" :size="14" />#{{ previous?.index ?? '—' }}
        </button>
        <button type="button" class="button button--ghost button--small" :disabled="!next" @click="emit('select', next)">
          #{{ next?.index ?? '—' }}<AppIcon name="chevron" :size="14" />
        </button>
      </footer>
    </aside>
  </Transition>
</template>
