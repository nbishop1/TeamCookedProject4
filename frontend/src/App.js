import { useEffect, useState } from "react";
import socket from "./socket"; // import your shared socket connection
import SelectWord from "./components/selectWord";  // <-- Import chat component
import Game from "./components/game";

function App() {
  const [name, setName] = useState("");
  const [hasName, setHasName] = useState(false);
  const [status, setStatus] = useState("Please Enter Your Name.");
  const [canChat, setCanChat] = useState(false);

  useEffect(() => {
    socket.on("requestName", (msg) => setStatus(msg));
    socket.on("waiting", (msg) => setStatus(msg));

    socket.on("startChat", (data) => {
      setStatus(data.message);
      setHasName(true);
      setCanChat(true);
    });

    return () => {
      socket.off("requestName");
      socket.off("waiting");
      socket.off("startChat");
    };
  }, []);

  // If user has NOT entered a name yet → show name screen
  if (!hasName) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Enter Name</h1>
        <p>{status}</p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          style={{ padding: "0.5rem", width: "300px" }}
        />

        <button
          onClick={() => socket.emit("submitName", name)}
          style={{ padding: "0.5rem 1rem", marginLeft: "0.5rem" }}
        >
          Submit
        </button>
      </div>
    );
  }

  // If both players provided names → load chat area (SelectWord)
  if (canChat) {
    return <SelectWord socket={socket} />;
  }

  return <p style={{ padding: "2rem" }}>{status}</p>;
}

export default App;
