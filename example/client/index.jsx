import React from "react";
import { createRoot } from "react-dom/client";
import Module from "./module";
import Button from "./component/button";

createRoot(document.querySelector("#root")).render(<>
  <h1>Welcome to my Simple HMR Example</h1>
  <Module />
  <Button label="home" />
</>)
