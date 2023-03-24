import React, { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  return <div>
    <span>A counter with state : </span>
    <button onClick={() => setCount(count - 1)}>-</button>
    <span style={{ margin: "0 3px" }}>{count}</span>
    <button onClick={() => setCount(count + 1)}>+</button>
  </div>
};
