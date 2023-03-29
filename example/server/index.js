import http from "http";
import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { hello } from "./endpoints";
import SSR from "./ssr";
import HTML from "./html";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = http.createServer(async (req, res) => {
  if (req.url === "/hello") {
    return hello(res);
  }

  if (req.url === "/ssr") {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200)
    return res.end(SSR())
  }

  const path = req.url.split("?").shift();

  if (path === "/") {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200)
    res.end(HTML);
    return;
  }

  const file = resolve(__dirname, "..", "client" + path);

  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }

  res.setHeader("Content-Type", "text/javascript");
  res.writeHead(200);
  res.end(fs.readFileSync(file));
});

server.listen(3000);

console.log("Listening at http://localhost:3000");

export default server;
