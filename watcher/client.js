const ws = new WebSocket("ws" +
  (window.location.protocol === "https:" ? "s" : "") +
  "://" + window.location.host);

let tree, basePath;

function getModuleImportPath(modulePath) {
  if(!tree) tree = {};

  if(!tree[modulePath])
    tree[modulePath] = {}

  if(!tree[modulePath].id)
    tree[modulePath].id = 0;

  return modulePath.replace(basePath, "") + "?t=" + tree[modulePath].id;
}

function crawlToRoot(modulePath, id) {
  tree[modulePath].id = id;
  return tree[modulePath].parents
    ? tree[modulePath].parents.map(parent => crawlToRoot(parent, id))
    : [modulePath];
}

function updateModule(modulePath) {
  const id = Date.now();
  const rootModules = Array.from(new Set(crawlToRoot(modulePath, id).flat(Infinity)));
  return Promise.all(rootModules.map(rootModule => import(getModuleImportPath(rootModule))));
}

function removeError() {
  document.querySelector("#error-container")?.remove();
}

function displayError(errorData) {
  let errorContainer = document.querySelector("#error-container");
  if (!errorContainer) {
    errorContainer = document.createElement("div");
    errorContainer.setAttribute("id", "error-container");
    document.body.append(errorContainer);
    errorContainer.style.cssText = `
      padding: 1rem;
      position: fixed;
      height: 100%;
      width: 100%;
      top: 0;
      left: 0;
      background-color: rgba(255, 255, 255, 0.8);
    `;
  }
  errorContainer.innerText = errorData.map(error => `Error in file [${error.location.file}:${error.location.line}]\n` +
    error.notes.map(errorNote =>`> ${errorNote.location.lineText}`).join("\n") +
    `\n${error.text}`).join("\n");
}

function sleep(ms) {
  return new Promise(res => setTimeout(res), ms);
}

async function waitForServer() {
  try {
    await fetch(window.location.href);
  } catch (e) {
    await sleep(100);
    return waitForServer();
  }
}

ws.onmessage = async (message) => {
  const { type, data } = JSON.parse(message.data);

  switch (type) {
    case "setup":
      tree = data.tree;
      basePath = data.basePath;
      break;
    case "module":
      removeError()
      await updateModule(data)
      break;
    case "error":
      displayError(data);
      break;
    case "server":
      await sleep(100);
      await waitForServer();
      window.location.reload();
  }
};
