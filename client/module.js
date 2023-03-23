import component from "./render.js";

document.querySelector("#root").innerHTML = `
<div>Edit <code>module.js</code> to live updates this pretty nice.</div>

<div>
  <b>Client Side Render</b><br />
  ${component()}
</div>`;
