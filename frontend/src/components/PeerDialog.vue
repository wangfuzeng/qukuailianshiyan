<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])
const host = ref('127.0.0.1')
const port = ref('6002')
const input = ref(null)

const error = computed(() => {
  if (!host.value.trim() || !port.value.trim()) return '请填写主机地址和 P2P 端口'
  const value = Number(port.value)
  if (!Number.isInteger(value) || value < 1 || value > 65535) return '端口必须是 1–65535 之间的整数'
  return ''
})

watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  input.value?.focus()
})

const submit = () => {
  if (error.value || props.submitting) return
  emit('submit', { host: host.value.trim(), port: Number(port.value) })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-layer" role="dialog" aria-modal="true" aria-labelledby="peer-title" @click.self="!submitting && emit('close')" @keydown.esc="!submitting && emit('close')">
        <div class="modal-card modal-card--compact">
          <header class="modal-header">
            <span class="modal-icon modal-icon--steel"><AppIcon name="node" :size="22" /></span>
            <div><span class="eyebrow">PEER DISCOVERY</span><h2 id="peer-title">接入对等节点</h2></div>
            <button type="button" class="icon-button modal-close" aria-label="关闭" :disabled="submitting" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
          </header>
          <form @submit.prevent="submit">
            <div class="peer-input-grid">
              <label class="field-group"><span class="field-label">主机地址</span><input ref="input" v-model="host" class="text-input text-input--single" type="text" placeholder="127.0.0.1" :disabled="submitting" /></label>
              <label class="field-group"><span class="field-label">P2P 端口</span><input v-model="port" class="text-input text-input--single" type="number" min="1" max="65535" placeholder="6002" :disabled="submitting" /></label>
            </div>
            <span class="field-error field-error--block">{{ error }}</span>
            <div class="mine-note mine-note--steel"><AppIcon name="info" :size="16" />填写目标节点开放的 TCP P2P 端口，而不是 REST API 端口。</div>
            <footer class="modal-actions">
              <button type="button" class="button button--ghost" :disabled="submitting" @click="emit('close')">取消</button>
              <button type="submit" class="button button--steel" :disabled="submitting"><span v-if="submitting" class="button-spinner"></span><AppIcon v-else name="link" :size="17" />{{ submitting ? '正在连接…' : '连接节点' }}</button>
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
