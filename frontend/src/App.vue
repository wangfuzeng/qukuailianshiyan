<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ActivityFeed from './components/ActivityFeed.vue'
import AppIcon from './components/AppIcon.vue'
import BlockDetailDrawer from './components/BlockDetailDrawer.vue'
import BlockList from './components/BlockList.vue'
import CommandPalette from './components/CommandPalette.vue'
import MineDialog from './components/MineDialog.vue'
import NodeTopology from './components/NodeTopology.vue'
import PeerDialog from './components/PeerDialog.vue'
import PulseChart from './components/PulseChart.vue'
import {
  connectPeer,
  fetchDashboardData,
  mineBlock,
  peerLabel,
  removePeer,
  subscribeNodeEvents,
  validateChain,
  verifyChain,
} from './services/blockchainApi.js'

const REFRESH_INTERVAL = 30_000
const blocks = ref([])
const peers = ref([])
const nodeInfo = ref({})
const stats = ref({})
const activities = ref([])
const loading = ref(true)
const refreshing = ref(false)
const online = ref(false)
const sseConnected = ref(false)
const errorMessage = ref('')
const lastUpdatedAt = ref(null)
const latency = ref(null)
const chainStatus = ref('unknown')
const activeTab = ref('ledger')
const searchQuery = ref('')
const expandedLedger = ref(false)
const selectedBlock = ref(null)
const copiedKey = ref('')
const toast = ref({ message: '', tone: 'success' })
const mineDialogOpen = ref(false)
const peerDialogOpen = ref(false)
const paletteOpen = ref(false)
const mining = ref(false)
const connecting = ref(false)
const busyPeer = ref('')
const validating = ref(false)
const topologyPulse = ref(0)

let refreshTimer = null
let toastTimer = null
let copyTimer = null
let stopEvents = null
let refreshInFlight = null
let refreshQueued = false

const latestBlock = computed(() => blocks.value.at(-1) || null)
const chainHeight = computed(() => stats.value.blockCount ?? nodeInfo.value.blockCount ?? blocks.value.length)
const difficulty = computed(() => stats.value.difficulty ?? nodeInfo.value.difficulty ?? 3)
const normalizedPeers = computed(() => [...new Set(peers.value.map(peerLabel))])
const updatedLabel = computed(() => lastUpdatedAt.value
  ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(lastUpdatedAt.value)
  : '尚未同步')
const chainLabel = computed(() => chainStatus.value === 'valid' ? '完整' : chainStatus.value === 'invalid' ? '异常' : '待校验')
const chainHint = computed(() => {
  if (!online.value) return '后端未连接'
  if (chainStatus.value === 'valid') return '哈希与前序引用均有效'
  if (chainStatus.value === 'invalid') return '检测到链数据不一致'
  return '等待区块数据'
})
const averageInterval = computed(() => {
  const ms = Number(stats.value.averageBlockIntervalMs)
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.round(ms / 60_000)} min`
})
const uptimeLabel = computed(() => {
  const ms = Number(stats.value.uptimeMs)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`
})
const dataSizeLabel = computed(() => {
  const bytes = Number(stats.value.totalDataBytes)
  if (!Number.isFinite(bytes)) return '—'
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})
const commandActions = [
  { id: 'mine', label: '挖掘新区块', hint: '写入一条新的链上数据', icon: 'pickaxe' },
  { id: 'peer', label: '接入对等节点', hint: '通过 host 与 P2P 端口连接节点', icon: 'node' },
  { id: 'validate', label: '执行链完整性校验', hint: '让后端验证整条区块链', icon: 'shield' },
  { id: 'sync', label: '立即同步数据', hint: '重新拉取区块、节点与统计', icon: 'refresh' },
]

function showToast(message, tone = 'success') {
  toast.value = { message, tone }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = { message: '', tone: 'success' } }, 3200)
}

async function syncDashboard({ silent = false } = {}) {
  if (refreshInFlight) {
    refreshQueued = true
    return refreshInFlight
  }
  if (!silent) refreshing.value = true
  refreshInFlight = (async () => {
    try {
      const snapshot = await fetchDashboardData()
      const previousLatest = latestBlock.value?.hash
      blocks.value = snapshot.blocks
      peers.value = snapshot.peers
      nodeInfo.value = snapshot.nodeInfo
      stats.value = snapshot.stats
      activities.value = snapshot.activity
      latency.value = snapshot.latency
      online.value = true
      errorMessage.value = ''
      lastUpdatedAt.value = new Date()
      chainStatus.value = (await verifyChain(snapshot.blocks)).status
      if (previousLatest && latestBlock.value?.hash !== previousLatest) topologyPulse.value += 1
    } catch (error) {
      online.value = false
      chainStatus.value = 'unknown'
      errorMessage.value = error.message
    } finally {
      loading.value = false
      refreshing.value = false
      refreshInFlight = null
      if (refreshQueued) {
        refreshQueued = false
        syncDashboard({ silent: true })
      }
    }
  })()
  return refreshInFlight
}

function scheduleRefresh() {
  window.clearInterval(refreshTimer)
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') syncDashboard({ silent: true })
  }, REFRESH_INTERVAL)
}

async function handleMine(data) {
  mining.value = true
  try {
    const block = await mineBlock(data)
    mineDialogOpen.value = false
    showToast(`区块 #${block.index} 已写入区块链`)
    await syncDashboard({ silent: true })
  } catch (error) {
    showToast(error.message, 'error')
  } finally {
    mining.value = false
  }
}

async function handleConnectPeer({ host, port }) {
  connecting.value = true
  try {
    await connectPeer({ host, port })
    peerDialogOpen.value = false
    showToast(`已发起连接 ${host}:${port}`)
    window.setTimeout(() => syncDashboard({ silent: true }), 500)
  } catch (error) {
    showToast(error.message, 'error')
  } finally {
    connecting.value = false
  }
}

async function handleRemovePeer(peer) {
  busyPeer.value = peer
  try {
    await removePeer(peer)
    showToast(`已断开节点 ${peer}`)
    await syncDashboard({ silent: true })
  } catch (error) {
    showToast(error.message, 'error')
  } finally {
    busyPeer.value = ''
  }
}

async function handleValidate() {
  validating.value = true
  try {
    const result = await validateChain()
    showToast(result.valid ? '链完整性校验通过' : '链完整性校验失败', result.valid ? 'success' : 'error')
    await syncDashboard({ silent: true })
  } catch (error) {
    showToast(error.message, 'error')
  } finally {
    validating.value = false
  }
}

async function copyValue(value, key) {
  try {
    await navigator.clipboard.writeText(String(value))
  } catch {
    const area = document.createElement('textarea')
    area.value = String(value)
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copiedKey.value = key
  showToast('已复制到剪贴板')
  window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => { copiedKey.value = '' }, 1800)
}

function openBlock(block) { selectedBlock.value = block }

function runPaletteAction(action) {
  if (action === 'mine') mineDialogOpen.value = true
  else if (action === 'peer') peerDialogOpen.value = true
  else if (action === 'validate') handleValidate()
  else if (action === 'sync') syncDashboard()
}

function onKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    paletteOpen.value = true
  }
  if (event.key === 'Escape') {
    selectedBlock.value = null
    paletteOpen.value = false
  }
}

onMounted(() => {
  syncDashboard()
  scheduleRefresh()
  window.addEventListener('keydown', onKeydown)
  try {
    stopEvents = subscribeNodeEvents((payload) => {
      sseConnected.value = true
      if (payload.reason?.includes('mine') || payload.reason?.includes('p2p')) topologyPulse.value += 1
      syncDashboard({ silent: true })
    })
  } catch {
    sseConnected.value = false
  }
})

onBeforeUnmount(() => {
  window.clearInterval(refreshTimer)
  window.clearTimeout(toastTimer)
  window.clearTimeout(copyTimer)
  window.removeEventListener('keydown', onKeydown)
  stopEvents?.()
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#ledger" aria-label="链脉 ChainPulse 区块链控制台">
        <span class="brand-mark"><AppIcon name="blocks" :size="21" /></span>
        <span class="brand-copy"><strong>CHAINPULSE</strong><small>链脉 · 区块链实验控制台</small></span>
      </a>
      <div class="network-pill" :class="{ 'network-pill--offline': !online }">
        <span class="network-dot"></span><span>{{ online ? '节点在线' : '节点离线' }}</span>
        <span class="network-divider"></span><code>API :{{ nodeInfo.apiPort ?? 3001 }}</code>
        <span class="network-divider"></span><span>{{ sseConnected ? '实时流已连接' : '轮询兜底中' }}</span>
      </div>
      <div class="topbar-actions">
        <button type="button" class="command-trigger" @click="paletteOpen = true"><AppIcon name="command" :size="15" /><span>快速操作</span><kbd>⌘ K</kbd></button>
        <button type="button" class="button button--ghost" :disabled="refreshing" @click="syncDashboard()"><AppIcon name="refresh" :size="16" :class="{ spinning: refreshing }" />同步</button>
        <button type="button" class="button button--primary" :disabled="!online" @click="mineDialogOpen = true"><AppIcon name="pickaxe" :size="16" />写入区块</button>
      </div>
    </header>

    <main class="page">
      <section class="hero-section hero-section--compact">
        <div class="hero-copy">
          <span class="eyebrow"><i></i>LIVE CONTROL ROOM</span>
          <h1>让每一次上链<br /><em>都有迹可循</em></h1>
          <p>从区块生成、哈希链接到节点广播，实时掌握账本、网络与每一次写入。</p>
          <div class="hero-actions">
            <button type="button" class="button button--ghost" @click="peerDialogOpen = true"><AppIcon name="link" :size="16" />接入节点</button>
            <button type="button" class="button button--ghost" :disabled="validating" @click="handleValidate"><AppIcon name="shield" :size="16" />{{ validating ? '校验中…' : '校验全链' }}</button>
          </div>
        </div>
        <div class="hero-pulse">
          <div class="hero-pulse__head"><div><span class="eyebrow">BLOCK PULSE</span><strong>最近出块节奏</strong></div><span class="pulse-live"><i></i>LIVE</span></div>
          <PulseChart :blocks="blocks" />
          <div class="hero-pulse__foot"><span>平均间隔 <b>{{ averageInterval }}</b></span><span>链数据 <b>{{ dataSizeLabel }}</b></span></div>
        </div>
      </section>

      <div v-if="errorMessage" class="alert-banner">
        <span class="alert-icon"><AppIcon name="alert" :size="19" /></span>
        <div><strong>无法读取后端节点数据</strong><p>{{ errorMessage }}</p><small>请确认 API 已启动，并在 CLI 输入 <code>api 3001</code>。</small></div>
        <button type="button" class="button button--ghost button--small" :disabled="refreshing" @click="syncDashboard()">重试</button>
      </div>

      <section class="stats-grid" aria-label="节点与区块链概览">
        <article class="stat-card stat-card--gold"><div class="stat-card__head"><span class="stat-card__label">区块高度</span><span class="stat-card__icon"><AppIcon name="blocks" :size="19" /></span></div><strong class="stat-card__value">{{ chainHeight }}</strong><span class="stat-card__hint">最新 {{ latestBlock ? `#${latestBlock.index}` : '—' }} · {{ updatedLabel }}</span></article>
        <article class="stat-card stat-card--steel"><div class="stat-card__head"><span class="stat-card__label">直接节点</span><span class="stat-card__icon"><AppIcon name="node" :size="19" /></span></div><strong class="stat-card__value">{{ normalizedPeers.length }}</strong><span class="stat-card__hint">P2P 端口 {{ nodeInfo.p2pPort ? `:${nodeInfo.p2pPort}` : '未开放' }}</span></article>
        <article class="stat-card stat-card--copper"><div class="stat-card__head"><span class="stat-card__label">运行时长</span><span class="stat-card__icon"><AppIcon name="clock" :size="19" /></span></div><strong class="stat-card__value">{{ uptimeLabel }}</strong><span class="stat-card__hint">难度 {{ difficulty }} · SHA-256 PoW</span></article>
        <article class="stat-card stat-card--lavender"><div class="stat-card__head"><span class="stat-card__label">链完整性</span><span class="stat-card__icon"><AppIcon name="shield" :size="19" /></span></div><strong class="stat-card__value">{{ chainLabel }}</strong><span class="stat-card__hint">{{ chainHint }} · {{ latency ?? '—' }} ms</span></article>
      </section>

      <section id="ledger" class="console-grid">
        <div class="console-main">
          <div class="workspace-tabs" role="tablist" aria-label="工作区">
            <button type="button" role="tab" :aria-selected="activeTab === 'ledger'" :class="{ active: activeTab === 'ledger' }" @click="activeTab = 'ledger'"><AppIcon name="blocks" :size="15" />区块账本<span>{{ blocks.length }}</span></button>
            <button type="button" role="tab" :aria-selected="activeTab === 'activity'" :class="{ active: activeTab === 'activity' }" @click="activeTab = 'activity'"><AppIcon name="activity" :size="15" />实时活动<span>{{ activities.length }}</span></button>
            <button type="button" role="tab" :aria-selected="activeTab === 'health'" :class="{ active: activeTab === 'health' }" @click="activeTab = 'health'"><AppIcon name="shield" :size="15" />链体检</button>
          </div>

          <div v-if="activeTab === 'ledger'" class="panel ledger-panel">
            <header class="ledger-heading">
              <div><span class="eyebrow">LEDGER EXPLORER</span><h2>区块记录</h2><p>{{ latestBlock ? `最新区块 #${latestBlock.index} · 点击任意区块查看取证详情` : '等待后端区块数据' }}</p></div>
              <div class="ledger-tools"><label class="search-box"><AppIcon name="search" :size="16" /><input v-model="searchQuery" type="search" placeholder="搜索索引、哈希或内容" /><button v-if="searchQuery" type="button" class="search-clear" aria-label="清除搜索" @click="searchQuery = ''"><AppIcon name="close" :size="13" /></button></label><button type="button" class="icon-button" aria-label="刷新账本" :disabled="refreshing" @click="syncDashboard()"><AppIcon name="refresh" :size="17" :class="{ spinning: refreshing }" /></button></div>
            </header>
            <div class="ledger-meta"><span><i></i>{{ updatedLabel }} 更新</span><span>{{ blocks.length }} 个区块</span><span v-if="online" class="latency-tag"><AppIcon name="activity" :size="13" />{{ latency }} ms</span></div>
            <div v-if="loading" class="loading-state"><span class="large-spinner"></span><strong>正在读取后端数据</strong><small>区块、节点与统计同步中…</small></div>
            <template v-else><BlockList :blocks="blocks" :search-query="searchQuery" :copied-key="copiedKey" :expanded="expandedLedger" @copy="copyValue" @open="openBlock" /><button v-if="blocks.length > 8 || searchQuery" type="button" class="button button--ghost ledger-expand" @click="expandedLedger = !expandedLedger">{{ expandedLedger ? '收起区块列表' : '展开全部区块' }}</button></template>
          </div>

          <ActivityFeed v-else-if="activeTab === 'activity'" :activities="activities" :loading="loading" />

          <div v-else class="panel health-panel">
            <div class="panel-heading"><div><span class="eyebrow">CHAIN HEALTH</span><h2>链体检</h2></div><span class="integrity-badge">{{ chainLabel }}</span></div>
            <p class="health-lead">{{ chainHint }}。校验同时覆盖区块内容哈希与前序区块链接。</p>
            <div class="health-list">
              <div class="health-row"><span>浏览器端复算</span><strong>{{ chainStatus === 'valid' ? '通过' : '待确认' }}</strong><i :class="{ ok: chainStatus === 'valid' }"></i></div>
              <div class="health-row"><span>后端校验接口</span><button type="button" class="button button--ghost button--small" :disabled="validating" @click="handleValidate">{{ validating ? '校验中…' : '运行后端校验' }}</button></div>
              <div class="health-row"><span>创世区块</span><strong>{{ blocks.length ? '已加载' : '缺失' }}</strong><i :class="{ ok: blocks.length > 0 }"></i></div>
              <div class="health-row"><span>最新高度</span><strong>#{{ latestBlock?.index ?? '—' }}</strong></div>
            </div>
            <div v-if="chainStatus === 'invalid'" class="alert-banner"><span class="alert-icon"><AppIcon name="alert" :size="19" /></span><div><strong>检测到链数据异常</strong><p>请检查返回区块的哈希、前序引用或内容字段。</p></div></div>
          </div>
        </div>

        <aside class="console-side">
          <NodeTopology :peers="normalizedPeers" :node-info="nodeInfo" :online="online" :pulse="topologyPulse" :busy-peer="busyPeer" @remove-peer="handleRemovePeer" />
          <section class="panel quick-panel">
            <div class="panel-heading"><div><span class="eyebrow">QUICK ACTIONS</span><h2>操作台</h2></div><AppIcon name="zap" :size="19" class="panel-heading__icon" /></div>
            <div class="quick-grid">
              <button type="button" class="quick-action" :disabled="!online" @click="mineDialogOpen = true"><AppIcon name="pickaxe" :size="18" /><span>写入新区块</span><small>PoW</small></button>
              <button type="button" class="quick-action" @click="peerDialogOpen = true"><AppIcon name="link" :size="18" /><span>接入节点</span><small>P2P</small></button>
              <button type="button" class="quick-action" :disabled="validating" @click="handleValidate"><AppIcon name="shield" :size="18" /><span>校验链</span><small>SHA-256</small></button>
              <button type="button" class="quick-action" @click="paletteOpen = true"><AppIcon name="search" :size="18" /><span>查找区块</span><small>⌘ K</small></button>
            </div>
          </section>
        </aside>
      </section>

      <footer class="page-footer"><span>ChainPulse · 链脉区块链实验网络</span><span class="footer-status"><i :class="{ 'is-online': online }"></i>{{ online ? 'API 数据连接正常' : 'API 未连接' }}</span></footer>
    </main>

    <BlockDetailDrawer :block="selectedBlock" :blocks="blocks" :copying-key="copiedKey" @close="selectedBlock = null" @select="openBlock" @copy="copyValue" />
    <CommandPalette :open="paletteOpen" :blocks="blocks" :actions="commandActions" @close="paletteOpen = false" @run-block="openBlock" @run-action="runPaletteAction" />
    <MineDialog :open="mineDialogOpen" :submitting="mining" @close="mineDialogOpen = false" @submit="handleMine" />
    <PeerDialog :open="peerDialogOpen" :submitting="connecting" @close="peerDialogOpen = false" @submit="handleConnectPeer" />
    <Transition name="toast"><div v-if="toast.message" class="toast" :class="`toast--${toast.tone}`" role="status"><AppIcon :name="toast.tone === 'error' ? 'alert' : 'check'" :size="15" />{{ toast.message }}</div></Transition>
  </div>
</template>
