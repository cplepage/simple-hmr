import React from "react";

export default function({ children }) {
  return <div style={{
    // Edit the styles here!!!
    // and see the macgic happen
    padding: 10,
    marginBottom: 10,
    border: "1px solid red"
  }}>
    {children}
  </div>
}
