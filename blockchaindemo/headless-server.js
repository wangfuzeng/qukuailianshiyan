// 无界面入口：与 cli.js 共用同一套区块链和 REST API 实现。
const P2p = require("./P2p");
const Blockchain = require("./Blockchain");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const blockchain = new Blockchain();
const p2p = new P2p(blockchain);
let apiServer = null;
const eventClients = new Set();
const activityLog = [];
const MAX_ACTIVITIES = 80;
const nodeStartedAt = Date.now();

function recordActivity(type, title, detail = {}) {
  activityLog.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    detail,
    at: Date.now(),
  });
  activityLog.splice(MAX_ACTIVITIES);
  const event = `event: activity\ndata: ${JSON.stringify(activityLog[0])}\n\n`;
  for (const client of eventClients) client.write(event);
}

function broadcastChainUpdate(reason, detail = {}) {
  const event = `event: chain-update\ndata: ${JSON.stringify({ reason, detail, at: Date.now() })}\n\n`;
  for (const client of eventClients) client.write(event);
}

p2p.onChange = (reason, detail = {}) => {
  if (reason === "peer-added") recordActivity("peer", "新节点已连接", detail);
  else if (reason === "peer-removed") recordActivity("peer", detail.manual ? "已主动断开节点" : "对等节点已离线", detail);
  else if (reason === "peer-handshake") recordActivity("peer", "节点握手完成", detail);
  else if (reason === "peer-error") recordActivity("error", "节点连接失败", detail);
  else if (reason === "p2p-block") recordActivity("sync", "收到 P2P 新区块", detail);
  else if (reason === "p2p-chain") recordActivity("sync", "已同步更长的区块链", detail);
  broadcastChainUpdate(reason, detail);
  if (apiServer) persistLatestChain();
};

let persistLatestChain = () => {};
function initHttpServer(port) {
  const app = express();
  // 数据文件位置：托管平台可挂载磁盘后，用 BLOCKCHAIN_DATA_FILE 指向持久化目录
  const chainFile = process.env.BLOCKCHAIN_DATA_FILE || path.join(__dirname, ".chain-data.json");
  app.use(cors());
  app.use(express.json());

  // 兼容前端以 /api 前缀发起的请求（Vite 开发代理的约定）。
  // 有了这段重写，开发模式下的 /api/blocks 和单端口模式下的 /blocks 走同一套路由。
  app.use((req, res, next) => {
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      req.url = req.url.slice(4) || "/";
    }
    next();
  });

  // Server-Sent Events：让页面在 CLI 挖矿或 P2P 收到新区块时立即刷新
  app.get("/events", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    res.write(": connected\n\n");
    eventClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      eventClients.delete(res);
    });
  });

  // 同一个 CLI 进程只保留一个 API 监听，避免重复输入 api 命令造成端口占用
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }

  // API 重启后恢复内存链，避免演示过程中因刷新或重启丢失区块
  try {
    if (fs.existsSync(chainFile)) {
      const savedChain = JSON.parse(fs.readFileSync(chainFile, "utf8"));
      if (Array.isArray(savedChain) && savedChain.length > blockchain.blockchain.length) {
        blockchain.restoreChain(savedChain);
      }
    }
  } catch (error) {
    console.log(`Could not restore local chain: ${error.message}`);
  }

  function persistChain() {
    try {
      fs.writeFileSync(chainFile, JSON.stringify(blockchain.blockchain, null, 2));
    } catch (error) {
      console.log(`Could not persist local chain: ${error.message}`);
    }
  }

  persistLatestChain = persistChain;

  app.get("/blocks", (req, res) => {
    res.send(blockchain.blockchain);
  });

  app.get("/activity", (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_ACTIVITIES)
      : 30;
    res.send(activityLog.slice(0, limit));
  });

  app.get("/stats", (req, res) => {
    const chain = blockchain.blockchain;
    const intervals = [];
    for (let index = 2; index < chain.length; index += 1) {
      const delta = Number(chain[index].timestamp) - Number(chain[index - 1].timestamp);
      if (Number.isFinite(delta) && delta >= 0) intervals.push(delta);
    }
    const latestBlock = blockchain.latestBlock;
    res.send({
      uptimeMs: Date.now() - nodeStartedAt,
      blockCount: chain.length,
      difficulty: blockchain.difficulty,
      chainValid: blockchain.isValidChain(chain),
      latestBlock: {
        index: latestBlock.index,
        hash: latestBlock.hash,
        timestamp: latestBlock.timestamp,
      },
      averageBlockIntervalMs: intervals.length
        ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
        : null,
      totalDataBytes: Buffer.byteLength(JSON.stringify(chain), "utf8"),
      peerCount: p2p.peers.length,
    });
  });

  app.post("/mineBlock", (req, res) => {
    const data = typeof req.body.data === "string" ? req.body.data.trim() : "";
    if (!data || data.length > 500) {
      res.status(400).send("data must be a non-empty string of at most 500 characters.");
      return;
    }
    const beforeIndex = blockchain.latestBlock.index;
    blockchain.mine(data);
    if (blockchain.latestBlock.index === beforeIndex) {
      res.status(500).send("block mining failed.");
      return;
    }
    const newBlock = blockchain.latestBlock;
    recordActivity("mine", "通过 API 写入新区块", {
      blockIndex: newBlock.index,
      source: "API",
    });
    persistChain();
    p2p.broadcastLatest();
    broadcastChainUpdate("api-mine", { blockIndex: newBlock.index, source: "API" });
    res.send(newBlock);
  });

  app.post("/validate", (req, res) => {
    const valid = blockchain.isValidChain(blockchain.blockchain);
    recordActivity(
      "system",
      valid ? "链完整性校验通过" : "链完整性校验失败",
      { source: "Web", blockIndex: blockchain.latestBlock.index },
    );
    broadcastChainUpdate("validated", { valid });
    res.send({ valid, blockCount: blockchain.blockchain.length });
  });

  app.get("/peers", (req, res) => {
    res.send(
      p2p.peers.map((s) => {
        const host = s.peerInfo?.host || s.remoteAddress;
        const port = s.peerInfo?.port || s.remotePort;
        return `${host}:${port}`;
      }),
    );
  });

  app.get("/nodeInfo", (req, res) => {
    res.send({
      p2pPort: p2p.serverPort,
      apiPort: port,
      difficulty: blockchain.difficulty,
      blockCount: blockchain.blockchain.length,
      startedAt: nodeStartedAt,
    });
  });

  app.post("/addPeer", (req, res) => {
    const peer = req.body.peer;
    const host = peer?.host || peer?.split?.(":")[0];
    const port = Number(peer?.port || peer?.split?.(":")[1]);

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      res.status(400).send("peer must contain a valid host and port.");
      return;
    }

    p2p.connectToPeer(host, port);
    res.send();
    setTimeout(() => broadcastChainUpdate("peer-connected", { peer: `${host}:${port}` }), 100);
  });

  app.post("/removePeer", (req, res) => {
    const address = String(req.body.peer || "").trim();
    if (!address) {
      res.status(400).send("peer is required.");
      return;
    }
    if (!p2p.removePeer(address)) {
      res.status(404).send("peer not found.");
      return;
    }
    res.send({ removed: true, peer: address });
  });

  // ── 单端口模式：把已构建的前端（frontend/dist）一起托管 ──────────────
  // 存在 dist 时，直接打开 http://localhost:3001 就能看到完整界面，
  // 不需要再单独运行 `npm run dev` 启动前端服务。
  const distDir = path.join(__dirname, "..", "frontend", "dist");
  const hasFrontend = fs.existsSync(path.join(distDir, "index.html"));
  if (hasFrontend) {
    app.use(express.static(distDir, { extensions: ["html"] }));

    const API_PATHS = [
      "/blocks",
      "/activity",
      "/stats",
      "/mineBlock",
      "/validate",
      "/peers",
      "/nodeInfo",
      "/addPeer",
      "/removePeer",
      "/events",
    ];

    // SPA 兜底：非接口的 GET 请求一律返回 index.html，保证前端路由可刷新
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (API_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  apiServer = app.listen(port, () => {
    console.log(`'listening http on port` + port);
    if (hasFrontend) {
      console.log(`前端界面（单端口）：http://localhost:${port}`);
    } else {
      console.log(`未找到 frontend/dist，仅提供 API。请先执行：cd frontend && npm run build`);
    }
  });
}

// 端口优先级：云平台注入的 PORT > 项目自定义变量 > 本地默认值
const p2pPort = Number(process.env.BLOCKCHAIN_P2P_PORT) || 6001;
const apiPort = Number(process.env.PORT) || Number(process.env.BLOCKCHAIN_API_PORT) || 3001;
// 大多数托管平台只对外开放一个 HTTP 端口，可用该变量关闭 P2P 以避免无意义的内网监听
if (process.env.BLOCKCHAIN_P2P_DISABLED === "1") {
  console.log("P2P 已按配置关闭（BLOCKCHAIN_P2P_DISABLED=1）");
} else {
  p2p.startServer(p2pPort);
}
initHttpServer(apiPort);
console.log(
  `Headless blockchain node started: P2P ${
    process.env.BLOCKCHAIN_P2P_DISABLED === "1" ? "disabled" : p2pPort
  }, API ${apiPort}`,
);