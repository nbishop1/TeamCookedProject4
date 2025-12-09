import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function SetName() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Welcome to Speed Card Game! Enter your name to start.");
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    // Player successfully joined
    socket.on("playerJoined", (data) => {
      setStatus(`Welcome, ${data.name}! You are Player ${data.playerIndex + 1}.`);
      setIsWaiting(true);
    });

    // Waiting for another player
    socket.on("waitingForPlayer", () => {
      setStatus("Waiting for another player to join...");
    });

    // Both players ready, show names
    socket.on("bothPlayersReady", (data) => {
      setStatus(`Game starting soon! ${data.player1Name} vs ${data.player2Name}`);
    });

    // Countdown started
    socket.on("countdown", (count) => {
      setCountdown(count);
      setStatus(`Game starting in ${count}...`);
    });

    // Game started - navigate to game
    socket.on("gameStarted", () => {
      setCountdown(null);
      navigate("/game");
    });

    // Handle errors
    socket.on("error", (message) => {
      alert(message);
      setIsWaiting(false);
    });

    // Handle player disconnection
    socket.on("playerDisconnected", () => {
      setStatus("Other player disconnected. Waiting for a new player...");
      setIsWaiting(false);
      setCountdown(null);
    });

    return () => {
      socket.off("playerJoined");
      socket.off("waitingForPlayer");
      socket.off("bothPlayersReady");
      socket.off("countdown");
      socket.off("gameStarted");
      socket.off("error");
      socket.off("playerDisconnected");
    };
  }, [navigate]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      submitName();
    }
  };

  const submitName = () => {
    if (name.trim() === "") {
      alert("Name cannot be empty!");
      return;
    }

    socket.emit("joinGame", name.trim());
    setIsWaiting(true);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif",
      background: "linear-gradient(135deg, #1e3c72, #2a5298)",
      color: "white"
    }}>
      <h1 style={{ fontSize: "3em", marginBottom: "20px", textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
        Speed Card Game
      </h1>

      <div style={{
        background: "rgba(255,255,255,0.1)",
        padding: "30px",
        borderRadius: "15px",
        textAlign: "center",
        minWidth: "400px",
        backdropFilter: "blur(10px)"
      }}>
        <p style={{ fontSize: "1.2em", marginBottom: "20px" }}>{status}</p>

        {countdown && (
          <div style={{
            fontSize: "4em",
            fontWeight: "bold",
            color: "#FFD700",
            textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
            animation: "pulse 1s infinite"
          }}>
            {countdown}
          </div>
        )}

        {!isWaiting && !countdown && (
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter your name"
              maxLength={20}
              style={{
                padding: "12px",
                fontSize: "1.1em",
                borderRadius: "8px",
                border: "none",
                marginBottom: "15px",
                width: "250px",
                textAlign: "center"
              }}
              autoFocus
            />
            <br />
            <button
              onClick={submitName}
              style={{
                padding: "12px 30px",
                fontSize: "1.1em",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "background-color 0.3s"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "#45a049"}
              onMouseOut={(e) => e.target.style.backgroundColor = "#4CAF50"}
            >
              Join Game
            </button>
          </div>
        )}

        {isWaiting && !countdown && (
          <div style={{ fontSize: "1.1em" }}>
            <div style={{
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #3498db",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              animation: "spin 2s linear infinite",
              margin: "20px auto"
            }}></div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}
