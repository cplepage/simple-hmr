import React from "react";

export default function({ text }) {
  return <div>
    <h4>This text is passed by props</h4>
    <p style={{
      border: "1px solid lightgray",
      width: "max-content",
      padding: 10
    }}>{text}</p>
  </div>
}
