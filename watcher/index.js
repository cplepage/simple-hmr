import Builder, { bundleCSSFiles } from "./builder.js";
import { dirname, resolve } from "path";
import { WebSocketServer } from "ws";
import fs from "fs"

const clientWatcherScript = fs.readFileSync("./watcher/client.js");

export default async function(clientEntrypoint, serverEntrypoint) {
  const clientBaseDir = dirname(clientEntrypoint);
  const clientBuild = await Builder({
    entrypoint: clientEntrypoint,
    recurse: true,
    useModuleProjectPaths: true,
    moduleResolverWrapperFunction: "getModuleImportPath",
    externalModules: {
      convert: true,
      bundle: true,
      bundleOutdir: resolve("dist", clientBaseDir)
    }
  });
  const clientModuleTree = clientBuild.modulesFlatTree;


  const serverBuild = await Builder({
    entrypoint: serverEntrypoint,
    recurse: true,
    moduleResolverWrapperFunction: "getModuleImportPath",
    externalModules: {
      convert: false,
    }
  });
  const serverModuleTree = serverBuild.modulesFlatTree;


  global.getModuleImportPath = (modulePath, currentModulePath) => {
    const modulePathSplitAtDots = modulePath.split(".");
    modulePathSplitAtDots.pop();
    const safeJSModulePath = modulePathSplitAtDots.join(".") + ".js";
    const fixedModulePath = resolve(dirname((new URL(currentModulePath)).pathname), modulePath)
      .replace(process.cwd(), ".")
      .replace("/dist", "");
    return safeJSModulePath + (serverModuleTree && serverModuleTree[fixedModulePath].id ? "?t=" + serverModuleTree[fixedModulePath].id : "")
  };

  let server, activeSockets = new Set();
  const loadServer = async () => {
    server = (await import(resolve("./dist", serverEntrypoint) + `?t=${Date.now()}`)).default;

    server.prependListener('request', (_, res) => {
      const originalEnd = res.end.bind(res);
      res.end = function(chunk, encoding, callback) {

        const mimeType = res.getHeader("Content-Type");

        if (mimeType === 'text/html') {
          res.write(chunk, encoding);
          res.write(`<script>${clientWatcherScript}</script>`);
          return originalEnd(undefined, undefined, callback);
        }

        originalEnd(chunk, encoding, callback);
      }
    });

    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    server.on('connection', function(socket) {
      activeSockets.add(socket)

      socket.on('close', function() {
        activeSockets.delete(socket)
      });
    });

  }

  let reloading = false;
  const reloadServer = () => {
    if (reloading) return
    reloading = true;
    if (server) {
      console.log("Reloading server");
      activeSockets.forEach(socket => socket.destroy());
      server.close(() => {
        loadServer()
        reloading = false;
      });
    } else {
      reloading = false;
      loadServer();
    }
  }

  reloadServer();

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
        basePath: clientBaseDir,
        assetsPath: "/assets"
      }
    }));
  });


  const clientFilesWatchers = new Map();

  Object.keys(clientModuleTree).forEach(modulePath => {

    const initWatch = () => fs.watch(modulePath, async (eventType, filename) => {
      if (!["js", "jsx", "mjs", "ts", "tsx"].find(ext => modulePath.endsWith(ext))) {

        if (modulePath.endsWith(".css")) {
          await bundleCSSFiles(clientBuild.cssFiles, resolve("dist", clientBaseDir), "index.css");

          activeWS.forEach(ws => ws.send(JSON.stringify({
            type: "css",
            data: "index.css"
          })));

          return;
        }

        fs.copyFileSync(modulePath, clientModuleTree[modulePath].out)

        activeWS.forEach(ws => ws.send(JSON.stringify({
          type: "asset",
          data: modulePath
        })));

        if (!fs.existsSync(filename)) {
          clientFilesWatchers.get(modulePath).close();
          clientFilesWatchers.set(modulePath, initWatch());
        }

        return;
      }

      try {
        await Builder({
          entrypoint: modulePath,
          recurse: false,
          useModuleProjectPaths: true,
          moduleResolverWrapperFunction: "getModuleImportPath",
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
        data: modulePath
      })));

    })

    clientFilesWatchers.set(modulePath, initWatch());
  });

  function crawlToRoot(modulePath, id) {
    serverModuleTree[modulePath].id = id;
    return serverModuleTree[modulePath].parents
      ? serverModuleTree[modulePath].parents.map(parent => crawlToRoot(parent, id))
      : [modulePath];
  }

  function updateModule(modulePath) {
    const id = Date.now();
    crawlToRoot(modulePath, id);
  }

  Object.keys(serverModuleTree).forEach(modulePath => {
    fs.watch(modulePath, async () => {

      try {
        await Builder({
          entrypoint: modulePath,
          recurse: false,
          moduleResolverWrapperFunction: "getModuleImportPath",
          externalModules: {
            convert: false,
          }
        });
      } catch (e) {
        activeWS.forEach(ws => ws.send(JSON.stringify({
          type: "error",
          data: e.errors
        })));
        return;
      }

      updateModule(modulePath);

      activeWS.forEach(ws => ws.send(JSON.stringify({
        type: "server",
        data: modulePath
      })));

      reloadServer();
    });
  });

}
