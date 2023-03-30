import "./style.css";
import React from "react";
import { createRoot } from "react-dom/client";
import Module from "./module";
import Button from "./component/button";
import Box from "./component/box"

createRoot(document.querySelector("#root")).render(<>
  <h1>Welcome to my Simple HMR Example</h1>
  <p>
    This setup is proof of concept / developer tool embryo.
  </p>
  <p>
    It is a very simple Client Hot Module Replacement and Server Hot Reload setup.
    The DX is quite amazing!
  </p>
  <p>
    Edit any files in the <code>./example</code> directory and see the live change happen!
  </p>

  <hr />

  <label>This is an imported module</label>
  <Box>
    <Module />
  </Box>

  <hr />

  <p>
    This button is imported by both the <code>Index</code> and <code>Module</code>.
  </p>
  <p>
    Edit the style in <code>./example/client/component/button.jsx</code> and see it change at both places!
  </p>
  <Button label="Go to SSR page" onClick={() => window.location.href = "/ssr"} />
</>)
