const ws = new WebSocket("ws://" + window.location.host);
export const subscriptions = new Map();

ws.onmessage = ({ data }) => {
  const cb = subscriptions.get(data);
  if (cb) cb();
};

import("./module.js?" + Date.now());
subscriptions.set("client/module.js", () => import("./module.js?" + Date.now()));
