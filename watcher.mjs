import { WebSocketServer } from "ws";
import fs from "fs";
import { glob } from "glob";
import WatcherSubscription from "./watchSubscription.mjs";

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

const { server } = await import("./server/index.mjs");

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const filesToWatch = await glob('./**/*.{js,mjs}', { ignore: ["**/node_modules/**"] });
filesToWatch.forEach(filename => {
  fs.watch(filename, () => {
    const cb = WatcherSubscription.get(filename);
    if (cb) cb();
    activeWS.forEach(ws => ws.send(filename));
  });
});
