<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])
const data = ref('')
const input = ref(null)
const touched = ref(false)

const error = computed(() => {
  if (!touched.value && !data.value) return ''
  if (!data.value.trim()) return '请输入要写入区块的数据'
  if (data.value.trim().length > 500) return '数据不能超过 500 个字符'
  return ''
})

watch(() => props.open, async (open) => {
  if (!open) return
  data.value = ''
  touched.value = false
  await nextTick()
  input.value?.focus()
})

function submit() {
  touched.value = true
  if (error.value || props.submitting) return
  emit('submit', data.value.trim())
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-layer" role="dialog" aria-modal="true" aria-labelledby="mine-title" @click.self="!submitting && emit('close')" @keydown.esc="!submitting && emit('close')">
        <div class="modal-card">
          <div class="modal-glow"></div>
          <header class="modal-header">
            <span class="modal-icon"><AppIcon name="pickaxe" :size="22" /></span>
            <div><span class="eyebrow">WORK PROOF</span><h2 id="mine-title">挖掘新区块</h2></div>
            <button type="button" class="icon-button modal-close" aria-label="关闭" :disabled="submitting" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
          </header>
          <form @submit.prevent="submit">
            <label class="field-label" for="mine-data">区块数据</label>
            <textarea id="mine-data" ref="input" v-model="data" class="text-input" rows="5" maxlength="500" placeholder="例如：三亚学院 · 区块链课程实验" :disabled="submitting" @blur="touched = true"></textarea>
            <div class="field-meta"><span class="field-error">{{ error }}</span><span>{{ data.length }} / 500</span></div>
            <div class="mine-note"><AppIcon name="pulse" :size="16" />提交后将执行 SHA-256 工作量证明，并通过 P2P 广播给已连接节点。</div>
            <footer class="modal-actions">
              <button type="button" class="button button--ghost" :disabled="submitting" @click="emit('close')">取消</button>
              <button type="submit" class="button button--primary" :disabled="submitting">
                <span v-if="submitting" class="button-spinner"></span><AppIcon v-else name="pickaxe" :size="17" />
                {{ submitting ? '正在计算哈希…' : '开始挖矿' }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
