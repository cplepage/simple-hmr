const ws = new WebSocket("ws://" + window.location.host);

let tree, basePath;

window.getModuleImportPath = (modulePath) => {
  return modulePath.replace(basePath, "") + (tree && tree[modulePath].id ? "?t=" + tree[modulePath].id : "");
}

function crawlToRoot(modulePath, id) {
  tree[modulePath].id = id;
  return tree[modulePath].parents ? crawlToRoot(tree[modulePath].parents.at(0), id) : modulePath;
}

function updateModule(modulePath) {
  const id = Date.now();
  const rootModule = crawlToRoot(modulePath, id);
  return import(window.getModuleImportPath(rootModule));
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
  errorContainer.innerText = errorData.map(error => error.notes.map(errorNote =>
    `Error in file [${errorNote.location.file}:${errorNote.location.line}]
    > ${errorNote.location.lineText}
  `).join("\n") + `\n${error.text}`).join("\n");
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

  }
};
