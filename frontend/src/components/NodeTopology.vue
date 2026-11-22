<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  peers: { type: Array, default: () => [] },
  nodeInfo: { type: Object, default: () => ({}) },
  online: { type: Boolean, default: false },
  pulse: { type: Number, default: 0 },
  busyPeer: { type: String, default: '' },
})

const emit = defineEmits(['remove-peer'])
const selectedPeer = ref('')

const nodes = computed(() => {
  const total = Math.max(props.peers.length, 1)
  return props.peers.map((peer, index) => {
    const angle = ((index + 0.5) / total) * Math.PI * 2 - Math.PI / 2
    return {
      address: peer,
      x: 50 + Math.cos(angle) * 36,
      y: 50 + Math.sin(angle) * 30,
    }
  })
})

const peerPort = (peer) => peer.replace(/^.*:/, '')
const peerHost = (peer) => peer.replace(/:\d+$/, '')
</script>

<template>
  <section class="panel topology-panel">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">DIRECT TOPOLOGY</span>
        <h2>网络拓扑</h2>
      </div>
      <span class="topology-count">{{ peers.length }} peers</span>
    </div>

    <div class="topology-stage" :class="{ 'topology-stage--offline': !online }">
      <div class="topology-grid" aria-hidden="true"></div>
      <div class="topology-orbit topology-orbit--outer" aria-hidden="true"></div>
      <div class="topology-orbit topology-orbit--inner" aria-hidden="true"></div>
      <span class="topology-center-glow" aria-hidden="true"></span>

      <button
        v-for="node in nodes"
        :key="node.address"
        type="button"
        class="topology-node"
        :class="{ 'topology-node--focus': selectedPeer === node.address }"
        :style="{ left: `${node.x}%`, top: `${node.y}%` }"
        @click="selectedPeer = selectedPeer === node.address ? '' : node.address"
      >
        <span class="topology-link" :class="{ 'topology-link--active': pulse }"></span>
        <span class="topology-node__dot"><AppIcon name="node" :size="16" /></span>
        <span class="topology-node__label">{{ peerPort(node.address) }}</span>
      </button>

      <div class="topology-center">
        <span class="connection-state" :class="{ 'connection-state--online': online }"><i></i>{{ online ? 'LOCAL' : 'OFFLINE' }}</span>
        <strong>当前节点</strong>
        <small>:{{ nodeInfo.p2pPort ?? '—' }}</small>
      </div>

      <div v-if="!peers.length" class="topology-empty">
        <AppIcon name="link" :size="17" />暂无直接对等节点
      </div>
    </div>

    <p class="topology-note">
      <AppIcon name="info" :size="14" />仅展示当前节点直接确认的 P2P 邻居
    </p>

    <div v-if="selectedPeer" class="topology-detail">
      <div>
        <span>PEER ADDRESS</span>
        <strong>{{ peerHost(selectedPeer) }}</strong>
        <small>:{{ peerPort(selectedPeer) }}</small>
      </div>
      <button
        type="button"
        class="button button--danger button--small"
        :disabled="busyPeer === selectedPeer"
        @click="emit('remove-peer', selectedPeer)"
      >
        <span v-if="busyPeer === selectedPeer" class="button-spinner"></span>
        <AppIcon v-else name="trash" :size="14" />
        {{ busyPeer === selectedPeer ? '断开中' : '断开节点' }}
      </button>
    </div>
  </section>
</template>
