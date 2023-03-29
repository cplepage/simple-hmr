import React from "react";

export default function ({label, onClick}) {
  return <button style={{
    backgroundColor: "blue",
    color: "white",
    border: 0,
    padding: "10px 20px",
    borderRadius: 6,
    cursor: "pointer"
  }} onClick={() => {if(onClick) onClick()}}>{label}</button>;
}
