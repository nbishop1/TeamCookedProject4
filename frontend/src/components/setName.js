import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function SetName() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [hasName, setHasName] = useState(false);
  const [status, setStatus] = useState("Welcome to Hangman! Please enter your name to start playing.");

  useEffect(() => {
    // Server asks user to provide a name
    socket.on("requestName", (msg) => setStatus(msg));

    // Waiting for the other player
    socket.on("waiting", (msg) => setStatus(msg));

    // Both players have submitted names → navigate to SelectWord
    socket.on("startSelectWord", () => {
      setHasName(true);
      navigate("/selectWord");
    });

    // Handle reset from server
    socket.on("reset", (message) => {
      alert(message);
      setHasName(false);
      setName("");
      setStatus("Game reset. Please enter your name to start a new game.");
    });

    return () => {
      socket.off("requestName");
      socket.off("waiting");
      socket.off("startSelectWord");
      socket.off("reset");
    };
  }, [navigate]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      submitName();
    }
  };

  const submitName = () => {
    if (name.trim() === "") return alert("Name cannot be empty!");
    socket.emit("submitName", name);
    setHasName(true);
  };

  // If user has NOT entered a name yet → show name input screen
  if (!hasName) {
    return (
      <div style={{
        padding: "2rem",
        maxWidth: "500px",
        margin: "0 auto",
        textAlign: "center"
      }}>
        <h1>🎮 Hangman Game</h1>
        <p style={{ fontSize: "18px", marginBottom: "2rem" }}>{status}</p>

        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your name..."
            style={{
              padding: "0.75rem",
              width: "300px",
              fontSize: "16px",
              borderRadius: "5px",
              border: "2px solid #ddd",
              marginRight: "0.5rem"
            }}
            autoFocus
          />
          <button
            onClick={submitName}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Join Game
          </button>
        </div>

        <div style={{
          backgroundColor: "#f8f9fa",
          padding: "1rem",
          borderRadius: "5px",
          marginTop: "2rem"
        }}>
          <h3>How to Play:</h3>
          <ul style={{ textAlign: "left", maxWidth: "400px", margin: "0 auto" }}>
            <li>Two players take turns setting words and guessing</li>
            <li>Word setter can choose a custom word or get a random one</li>
            <li>Guesser has 6 wrong attempts to guess the word</li>
            <li>After both rounds, view the high scores!</li>
          </ul>
        </div>
      </div>
    );
  }

  // While waiting for the other player to submit a name
  return (
    <div style={{
      padding: "2rem",
      textAlign: "center",
      maxWidth: "500px",
      margin: "0 auto"
    }}>
      <h2>Waiting for Players</h2>
      <p style={{ fontSize: "18px" }}>{status}</p>
      <div style={{ marginTop: "2rem" }}>
        <div className="spinner" style={{
          border: "4px solid #f3f3f3",
          borderTop: "4px solid #007bff",
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          animation: "spin 2s linear infinite",
          margin: "0 auto"
        }}></div>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
