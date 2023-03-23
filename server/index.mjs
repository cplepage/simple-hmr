import http from "http";
import fs from "fs";

export const server = http.createServer(async (req, res) => {
  const path = req.url.split("?").shift();

  const file = path === "/"
    ? "./client/index.html"
    : "./dist/client/" + path;

  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }

  const ext = file.split('.').pop()

  let mime = "text/plain";
  switch (ext) {
    case "js":
      mime = "text/javascript";
      break;
    case "html":
      mime = "text/html";
      break;
  }

  res.writeHead(200, { "Content-Type": mime })
  res.end(await fs.promises.readFile(file));
});

server.listen(3000);
