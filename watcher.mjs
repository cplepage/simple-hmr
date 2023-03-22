import { WebSocketServer } from "ws";
import fs from "fs";

const wss = new WebSocketServer({ noServer: true });

const activeWS = new Set();
wss.on('connection', (ws) => {
  console.log("Received Web Socket Connection");
  activeWS.add(ws)
  ws.on('close', () => {
    console.log("Lost Web Socket Connection");
    activeWS.delete(ws);
  });
});

const { server } = await import("./server.mjs");

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

fs.watch("./module.js", (_, file) => {
  activeWS.forEach(ws => ws.send(file));
});
