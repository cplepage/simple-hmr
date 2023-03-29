import React, { useState, useEffect } from "react";

export default function() {
  const [message, setMessage] = useState();

  useEffect(() => {
    fetch("/hello")
      .then(res => res.text())
      .then(setMessage)
  }, [])

  return <div>
    Fetching from server :<br />
    <br />
    <b>{message}</b>

  </div>
}
