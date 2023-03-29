import React, { useState, useEffect } from "react";
import Button from "./component/button";

export default function() {
  const [message, setMessage] = useState();

  useEffect(() => {
    fetch("/hello")
      .then(res => res.text())
      .then(setMessage)
  }, [])

  return <div>
    Fetching from server nice :<br />
    <br />
    <b>{message}</b><br />
    <Button label="module"  />

  </div>
}
