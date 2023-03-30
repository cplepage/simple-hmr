import React, { useState, useEffect } from "react";
import Button from "./component/button";
import Box from "./component/box";

export default function() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("/hello")
      .then(res => res.text())
      .then(setMessage)
  }, [])

  return <div>
    <label>
      This is fetched from the server :
    </label>

    <Box>
      <b>{message}</b>
    </Box>

    <p>Edit <code>./example/server/endpoint.js</code> and see the change happen live!</p>

    <Button label="Button" />

  </div>
}
