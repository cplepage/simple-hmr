import Builder from "../builder.js";
import { dirname, resolve } from "path";
import { WebSocketServer } from "ws";
import fs from "fs"

const clientWatcherScript = fs.readFileSync("./watcher/client.js");

export default async function(clientEntrypoint, serverEntrypoint) {
  const clientBaseDir = dirname(clientEntrypoint);
  const clientModuleTree = await Builder({
    entrypoint: clientEntrypoint,
    recurse: true,
    useModuleProjectPaths: true,
    moduleResolverWrapperFunction: "window.getModuleImportPath",
    externalModules: {
      convert: true,
      bundle: true,
      bundleOutdir: resolve("dist", clientBaseDir)
    }
  });


  const serverModuleTree = await Builder({
    entrypoint: serverEntrypoint,
    recurse: true,
    externalModules: {
      convert: false,
    }
  });

  const server = (await import(resolve("./dist", serverEntrypoint))).default;

  server.prependListener('request', (_, res) => {
    const originalEnd = res.end.bind(res);
    res.end = function(chunk, encoding, callback) {

      const mimeType = res.getHeader("Content-Type");

      if (mimeType === "text/html") {
        res.write(`<script>${clientWatcherScript}</script>`);
      }

      originalEnd(chunk, encoding, callback);
    }
  });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });


  const wss = new WebSocketServer({ noServer: true });
  const activeWS = new Set();
  wss.on('connection', (ws) => {
    activeWS.add(ws)
    console.log(`Received Connection. Currently [${activeWS.size}] active conn.`);

    ws.on('close', () => {
      activeWS.delete(ws);
      console.log(`Lost Connection. Currently [${activeWS.size}] active conn.`);
    });

    ws.send(JSON.stringify({
      type: "setup",
      data: {
        tree: clientModuleTree,
        basePath: clientBaseDir
      }
    }));
  });


  Object.keys(clientModuleTree).forEach(modulePath => {
    const isJSX = clientModuleTree[modulePath].jsx;
    modulePath = isJSX ? modulePath + "x" : modulePath
    fs.watch(modulePath, async () => {

      try {
        await Builder({
          entrypoint: modulePath,
          recurse: false,
          useModuleProjectPaths: true,
          moduleResolverWrapperFunction: "window.getModuleImportPath",
          externalModules: {
            convert: true,
            bundle: false
          }
        });
      } catch (e) {
        activeWS.forEach(ws => ws.send(JSON.stringify({
          type: "error",
          data: e.errors
        })));
        return;
      }


      activeWS.forEach(ws => ws.send(JSON.stringify({
        type: "module",
        data: isJSX ? modulePath.slice(0, -1) : modulePath
      })));

    });
  });


  Object.keys(serverModuleTree).forEach(modulePath => {
    const isJSX = serverModuleTree[modulePath].jsx;
    modulePath = isJSX ? modulePath + "x" : modulePath
    fs.watch(modulePath, async () => {

      activeWS.forEach(ws => ws.send(JSON.stringify({
        type: "server",
        data: modulePath
      })));

    });
  });

}
