const ws = new WebSocket("ws://" + window.location.host);
const subscriptions = new Map();
function subscribeToModule(module, cb) {
  subscriptions.set(module, cb);
}
ws.onmessage = ({ data }) => subscriptions.get(data)();

import("./module.js?" + Date.now());
subscribeToModule("module.js", () => import("./module.js?" + Date.now()));
