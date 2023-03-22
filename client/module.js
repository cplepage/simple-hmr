import { subscriptions } from "./index.js";

let component = (await import("./render.js?" + Date.now())).default;
subscriptions.set("client/render.js", async () => {
  component = (await import("./render.js?" + Date.now())).default;
  script();
});

const script = async () => {
  document.querySelector("#root").innerHTML = `

    <div>Edit <code>module.js</code> to live updates this title</div>

    <div>
      <b>Client Side Render</b><br />
      ${component()}
    </div>

    <div>
      <b>Data Fetched from Server</b><br />
      ${await (await fetch("/hello")).text()}
    </div>`;

}

script();
subscriptions.set("server/endpoints.mjs", script);
