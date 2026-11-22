# 链脉 ChainPulse 前端

Vue 3 + Vite 实现的区块链节点浏览器，读取 `blockchaindemo` 暴露的 REST API。

## 启动

先启动并初始化后端节点：

```bash
cd blockchaindemo
npm start
```

在 CLI 中分别开启 P2P 与 API：

```text
open 6001
api 3001
```

再启动前端：

```bash
cd frontend
npm run dev
```

打开终端输出的地址（默认 `http://localhost:5173`）。

## 接口

开发环境由 Vite 将 `/api/*` 代理到 `http://localhost:3001`：

| 页面功能 | 后端接口 |
| --- | --- |
| 区块列表 | `GET /blocks` |
| 节点端口与高度 | `GET /nodeInfo` |
| 对等节点列表 | `GET /peers` |
| 挖掘新区块 | `POST /mineBlock` |
| 连接对等节点 | `POST /addPeer` |
| 实时变化通知（SSE） | `GET /events` |
| 节点与链统计 | `GET /stats` |
| 最近活动记录 | `GET /activity?limit=30` |
| 断开指定对等节点 | `POST /removePeer` |
| 服务端链完整性校验 | `POST /validate` |

区块与节点数据首次加载读取 `/blocks`、`/peers`、`/nodeInfo`。后端 CLI 挖矿、
API 挖矿、P2P 新区块、节点连接/断开都会通过 SSE 触发前端重新拉取接口；
页面同时每 30 秒轮询一次作为断线兜底。

部署到其他后端地址时，可复制 `.env.example` 为 `.env`，并修改 `VITE_API_BASE`。
注意 `.env` 中的 API 地址是构建时注入的，修改后需要重新执行 `npm run build`。

## 控制台功能

- **区块账本**：搜索索引、哈希和内容；点击区块打开取证详情，可复制哈希并跳转前后区块。
- **实时活动**：筛选写入、同步和节点事件；CLI、API、P2P 变化均会实时更新。
- **链体检**：浏览器复算哈希，同时可调用后端 `/validate` 做整链校验。
- **网络拓扑**：展示当前节点的直接 P2P 邻居，可查看地址和端口并主动断开。
- **快速操作**：`Ctrl/Cmd + K` 打开命令面板，快速搜索区块、挖矿、接入节点、校验或同步。

后端已实现活动日志和统计接口；活动日志保存在内存中，CLI 进程重启后清空，区块历史由 `.chain-data.json` 恢复。

## 构建

```bash
npm run build
npm run preview
```

构建产物位于 `dist/`。生产部署时需要让静态服务器把 `/api` 转发到节点 API。
