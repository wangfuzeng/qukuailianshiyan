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
  for (const client of eventClients) {
    client.write(event);
  }
}

function broadcastChainUpdate(reason, detail = {}) {
  const event = `event: chain-update\ndata: ${JSON.stringify({ reason, detail, at: Date.now() })}\n\n`;
  for (const client of eventClients) {
    client.write(event);
  }
}

p2p.onChange = (reason, detail = {}) => {
  if (reason === "peer-added") {
    recordActivity("peer", "新节点已连接", detail);
  } else if (reason === "peer-removed") {
    recordActivity("peer", detail.manual ? "已主动断开节点" : "对等节点已离线", detail);
  } else if (reason === "peer-handshake") {
    recordActivity("peer", "节点握手完成", detail);
  } else if (reason === "peer-error") {
    recordActivity("error", "节点连接失败", detail);
  } else if (reason === "p2p-block") {
    recordActivity("sync", "收到 P2P 新区块", detail);
  } else if (reason === "p2p-chain") {
    recordActivity("sync", "已同步更长的区块链", detail);
  }
  broadcastChainUpdate(reason, detail);
  if (apiServer) {
    persistLatestChain();
  }
};

let persistLatestChain = () => {};
// 主函数：初始化cli命令行页面
function cli(vorpal) {
  vorpal
    .use(welcome)
    .use(connectCommand)
    .use(discoverCommand)
    .use(blockchainCommand)
    .use(peersCommand)
    .use(mineCommand)
    .use(openCommand)
    .use(apiCommand)
    .delimiter("blockchain>>>>>>>>> ")
    .show();
}
module.exports = cli;
// 欢迎指令
function welcome(vorpal) {
  vorpal.log("欢迎来到blockchain命令行界面");
  vorpal.exec("help");
}
// 连接节点指令
function connectCommand(vorpal) {
  vorpal
    .command(
      "connect <host> <port>",
      "Connect to a new peer.eg: connect localhost 2727",
    )
    .alias("c")
    .action(function (args, callback) {
      if (args.host && args.port) {
        try {
          p2p.connectToPeer(args.host, args.port);
        } catch (err) {
          this.log(err.message);
        }
      }
      callback();
    });
}
// 发现节点指令，发现网络中的其他节点
function discoverCommand(vorpal) {
  vorpal
    .command("discover", "Discover new peers from your connected peers.")
    .alias("d")
    .action(function (args, callback) {
      try {
        p2p.discoverPeers();
      } catch (err) {
        this.log(err.message);
      }
      callback();
    });
}
// 区块链查看指令，显示当前区块链的所有完整信息
function blockchainCommand(vorpal) {
  vorpal
    .command("blockchain", "Show the current blockchain.")
    .alias("bc")
    .action(function (args, callback) {
      this.log(blockchain);
      callback();
    });
}
// 节点查看指令
function peersCommand(vorpal) {
  vorpal
    .command("peers", "Show the current peers.")
    .alias("p")
    .action(function (args, callback) {
      if (p2p.peers.length === 0) {
        this.log("No peers connected.");
      } else {
        this.log(`已连接的节点数量: ${p2p.peers.length}`);
        p2p.peers.forEach((peer, index) => {
          const host = peer.peerInfo?.host || peer.remoteAddress || "Unknown";
          const port = peer.peerInfo?.port || peer.remotePort || "Unknown";
          this.log(`Node ${index + 1}: ${host}:${port}`);
        }, this);
      }
      callback();
    });
}
// 挖矿指令
function mineCommand(vorpal) {
  vorpal
    .command("mine <data>", "Mine a new block. eg. mine 'hello111111'")
    .alias("m")
    .action(function (args, callback) {
      if (args.data) {
        const beforeIndex = blockchain.latestBlock.index;
        blockchain.mine(args.data);
        if (blockchain.latestBlock.index === beforeIndex) {
          callback();
          return;
        }
        recordActivity("mine", "命令行写入新区块", {
          blockIndex: blockchain.latestBlock.index,
          source: "CLI",
        });
        p2p.broadcastLatest();
        broadcastChainUpdate("cli-mine", { blockIndex: blockchain.latestBlock.index });
      }
      callback();
    });
}
// 开启端口指令
function openCommand(vorpal) {
  vorpal
    .command("open <port>", "Open a port for P2P communication. eg. open 2727")
    .alias("o")
    .action(function (args, callback) {
      if (args.port) {
        if (typeof args.port === "number") {
          p2p.startServer(args.port);
          this.log(`Server is running on port ${args.port}`);
        } else {
          this.log("Port not xing.");
        }
      }
      callback();
    });
}
// 开启api指令
function apiCommand(vorpal) {
  vorpal
    .command("api <port>", "Start api server. eg. api 3001")
    .alias("a")
    .action(function (args, callback) {
      if (args.port) {
        initHttpServer(args.port);
      }
      callback();
    });
}

function initHttpServer(port) {
  const app = express();
  const chainFile = path.join(__dirname, ".chain-data.json");
  app.use(cors());
  app.use(express.json());

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

  apiServer = app.listen(port, () => {
    console.log(`'listening http on port` + port);
  });
}
