
export default function() {
  return `
  <meta charset="utf-8">
  <link rel="stylesheet" href="/index.css">
  <h1>Hot Reload SSR page</h1>
  <p>This page is fully server side rendered</p>
  <p>Server side chagnes only hot reload the page (for now 😉)
  <p>Edit <code>./example/server/ssr.js</code> and see the page Hot Reload!</p>
  <a href="/">Go back to SPA like home page</a>`;
}
