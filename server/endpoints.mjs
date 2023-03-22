export default function(req, res) {
  if (req.url === "/hello") {
    res.end(`This data is from our Server<br />
      Edit <code>server/endpoints.mjs</code> to live update this text.`);
    return true;
  }

  return false;
}
