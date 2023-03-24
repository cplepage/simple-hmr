import React from "react";
import { Counter } from "./directory/render";
import Text from "./text";

export default function() {
  return <div>
    <h1>Dead Simple Hot Module Replacement with esbuild</h1>
    <Text text={<>This is still a WIP. I'm trying to make a very simple HMR setup<br />
      Edit the <code>./client</code> files to view the live changes.<br />
      Still have to figure out a bunch of stuff.</>} />
    <Counter />
  </div>
}
