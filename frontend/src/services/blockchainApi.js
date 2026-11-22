const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
const REQUEST_TIMEOUT = 8000

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(body || `请求失败（HTTP ${response.status}）`)
    }

    if (response.status === 204) return null
    const body = await response.text()
    return body ? JSON.parse(body) : null
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('连接后端超时，请检查节点 API 是否已启动')
    }
    if (error instanceof TypeError) {
      throw new Error('无法连接后端 API，请检查节点服务与端口配置')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchNodeSnapshot() {
  const startedAt = performance.now()
  const [blocks, peers, nodeInfo] = await Promise.all([
    request('/blocks'),
    request('/peers'),
    request('/nodeInfo'),
  ])

  if (!Array.isArray(blocks)) {
    throw new Error('节点返回的区块链数据格式不正确')
  }

  return {
    blocks,
    peers: Array.isArray(peers) ? peers : [],
    nodeInfo: nodeInfo || {},
    latency: Math.max(1, Math.round(performance.now() - startedAt)),
  }
}

export async function fetchDashboardData() {
  const [snapshot, stats, activity] = await Promise.all([
    fetchNodeSnapshot(),
    request('/stats'),
    request('/activity?limit=40'),
  ])
  return {
    ...snapshot,
    stats: stats || {},
    activity: Array.isArray(activity) ? activity : [],
  }
}

export async function fetchActivity(limit = 40) {
  const activity = await request(`/activity?limit=${limit}`)
  return Array.isArray(activity) ? activity : []
}

export function peerLabel(peer) {
  if (typeof peer === 'string') {
    const normalized = peer.replace(/^::ffff:/, '')
    const separator = normalized.lastIndexOf(':')
    if (separator > 0) {
      return `${normalized.slice(0, separator)}:${normalized.slice(separator + 1)}`
    }
    return normalized
  }
  return `${peer?.host || '未知主机'}:${peer?.port || '未知端口'}`
}

export function mineBlock(data) {
  return request('/mineBlock', {
    method: 'POST',
    body: JSON.stringify({ data }),
  })
}

export function connectPeer({ host, port }) {
  return request('/addPeer', {
    method: 'POST',
    body: JSON.stringify({ peer: { host, port } }),
  })
}

export function removePeer(peer) {
  return request('/removePeer', {
    method: 'POST',
    body: JSON.stringify({ peer }),
  })
}

export function validateChain() {
  return request('/validate', { method: 'POST' })
}

// 订阅后端变化事件；EventSource 断线时会自动重连
export function subscribeNodeEvents(onUpdate) {
  const source = new EventSource(`${API_BASE}/events`)
  const handleUpdate = (event) => {
    let payload = {}
    try {
      payload = JSON.parse(event.data)
    } catch {
      payload = {}
    }
    onUpdate(payload)
  }
  source.addEventListener('chain-update', handleUpdate)
  return () => {
    source.removeEventListener('chain-update', handleUpdate)
    source.close()
  }
}

const encoder = new TextEncoder()

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyChain(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { status: 'unknown', checked: 0, issues: [] }
  }

  if (!crypto?.subtle) {
    return { status: 'unavailable', checked: 0, issues: [] }
  }

  const issues = []

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const payload = `${block.index}${block.previousHash}${block.timestamp}${block.data}${block.nonce}`
    const calculatedHash = await sha256(payload)

    // 后端内置的创世块使用固定哈希，不参与当前算法的复算。
    if (index > 0 && calculatedHash !== block.hash) {
      issues.push(`#${block.index} 的哈希无法复算`)
    }

    if (index > 0 && block.previousHash !== blocks[index - 1].hash) {
      issues.push(`#${block.index} 与前序区块断链`)
    }
  }

  return {
    status: issues.length ? 'invalid' : 'valid',
    checked: blocks.length,
    issues,
  }
}
