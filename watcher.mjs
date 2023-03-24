import { WebSocketServer } from "ws";
import fs from "fs";
import builder from "./builder.mjs";

const wss = new WebSocketServer({ noServer: true });

try {
  await fs.promises.rm("dist", { recursive: true });
} catch (e) { }

const entrypoint = "./client/index.jsx";
const initialTree = await builder(entrypoint, true);

const activeWS = new Set();
wss.on('connection', (ws) => {
  console.log("Received Web Socket Connection");
  activeWS.add(ws)
  ws.on('close', () => {
    console.log("Lost Web Socket Connection");
    activeWS.delete(ws);
  });

  ws.send(JSON.stringify({
    type: "setup",
    data: {
      tree: initialTree,
      entrypoint,
      basePath: "./client"
    }
  }));
});

const { server } = await import("./server/index.mjs");

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

Object.keys(initialTree).forEach(modulePath => {
  fs.watch(modulePath, async () => {
    await builder(modulePath);
    activeWS.forEach(ws => ws.send(JSON.stringify({
      type: "module",
      data: modulePath
    })));
  });
});
