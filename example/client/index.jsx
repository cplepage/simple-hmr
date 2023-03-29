import React from "react";
import { createRoot } from "react-dom/client";
import Module from "./module";

createRoot(document.querySelector("#root")).render(<>
  <h1>Welcome to my Simple HMR Example</h1>
  <Module />
</>)
