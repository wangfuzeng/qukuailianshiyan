<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  blocks: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'run-block', 'run-action'])
const query = ref('')
const input = ref(null)

watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  await nextTick()
  input.value?.focus()
})

const matches = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const actions = props.actions
    .filter((action) => !keyword || `${action.label} ${action.hint}`.toLowerCase().includes(keyword))
    .map((action) => ({ ...action, kind: 'action' }))
  const blocks = props.blocks
    .filter((block) => {
      if (!keyword) return false
      return `${block.index} ${block.data} ${block.hash}`.toLowerCase().includes(keyword)
    })
    .slice(-4)
    .reverse()
    .map((block) => ({ id: `block-${block.index}`, label: `区块 #${block.index}`, hint: block.data, block, kind: 'block' }))
  return [...actions, ...blocks]
})

const choose = (item) => {
  if (item.kind === 'block') emit('run-block', item.block)
  else emit('run-action', item.id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="palette-layer" @click.self="emit('close')" @keydown.esc="emit('close')">
        <div class="palette-card" role="dialog" aria-modal="true" aria-label="命令面板">
          <div class="palette-search">
            <AppIcon name="search" :size="18" />
            <input ref="input" v-model="query" placeholder="搜索区块，或选择操作…" />
            <kbd>ESC</kbd>
          </div>
          <div class="palette-results">
            <button v-for="item in matches" :key="item.id" type="button" class="palette-item" @click="choose(item)">
              <span class="palette-item__icon"><AppIcon :name="item.kind === 'block' ? 'cube' : item.icon || 'command'" :size="16" /></span>
              <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
              <AppIcon name="chevron" :size="14" />
            </button>
            <div v-if="!matches.length" class="palette-empty">没有匹配的命令或区块</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
