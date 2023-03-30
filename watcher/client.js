const ws = new WebSocket("ws" +
  (window.location.protocol === "https:" ? "s" : "") +
  "://" + window.location.host);

let tree, basePath, assetsPath;

function getModuleImportPath(modulePath) {
  const modulePathSplitAtDots = modulePath.split(".");
  const ext = modulePathSplitAtDots.pop();

  const safeJSModulePath = ["js", "jsx", "mjs", "ts", "tsx"].includes(ext)
    ? modulePathSplitAtDots.join(".") + ".js"
    : assetsPath + "/" + tree[modulePath].assetName;

  if (!tree) tree = {};

  if (!tree[modulePath])
    tree[modulePath] = {}

  if (!tree[modulePath].id)
    tree[modulePath].id = 0;

  return safeJSModulePath.replace(basePath, "") + "?t=" + tree[modulePath].id;
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
    error.notes.map(errorNote => `> ${errorNote.location.lineText}`).join("\n") +
    `\n${error.text}`).join("\n");
}

function reloadCSSFile(cssFileName) {
  const styleTags = document.querySelectorAll("link");
  const currentTagToRemove = Array.from(styleTags).find(styleTag =>
    new URL(styleTag.getAttribute("href"), window.location.origin).pathname.endsWith(cssFileName));

  const newTag = document.createElement("link");
  newTag.href = "/" + cssFileName + "?t=" + Date.now();
  newTag.setAttribute("rel", "stylesheet");

  document.head.append(newTag);

  currentTagToRemove?.remove();
}

function sleep(ms) {
  return new Promise(res => setTimeout(res), ms);
}

async function waitForServer() {
  const signal = AbortSignal.timeout(500);
  try {
    await fetch(window.location.href, { signal });
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
      assetsPath = data.assetsPath;
      break;
    case "module":
      removeError()
      await updateModule(data)
      break;
    case "error":
      displayError(data);
      break;
    case "css":
      reloadCSSFile(data);
      break;
    case "asset":
      updateModule(data);
      console.log(tree);
      break;
    case "reload":
      window.location.reload();
      break;
    case "server":
      await sleep(100);
      await waitForServer();
      window.location.reload();
  }
};
