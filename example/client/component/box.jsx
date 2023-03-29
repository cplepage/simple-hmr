import React from "react";

export default function ({children}) {
  return <div style={{
    padding: 10,
    border: "1px solid red"
  }}>
    {children}
  </div>
}
