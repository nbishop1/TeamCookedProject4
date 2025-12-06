import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function HighScores() {
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchScores();

    socket.on("reset", (message) => {
      alert(message);
      navigate("/");
    });

    return () => {
      socket.off("reset");
    };
  }, [navigate]);

  const fetchScores = async () => {
    try {
      setLoading(true);
      setError("");

      // First, establish a session
      const sessionResponse = await fetch("http://localhost:3001/sessionSet/highscores-viewer", {
        credentials: "include"
      });

      if (!sessionResponse.ok) {
        console.warn("Could not establish session, continuing anyway");
      }

      // Then fetch scores
      const response = await fetch("http://localhost:3001/hangman/scores", {
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        setScores(data);
      } else {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        setError(`Failed to load high scores: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error fetching scores:", err);
      setError("Error connecting to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }; const startNewGame = () => {
    navigate("/");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Loading High Scores...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>High Scores</h1>
        <p style={{ color: "red" }}>{error}</p>
        <button
          onClick={fetchScores}
          style={{ padding: "0.5rem 1rem", marginRight: "1rem" }}
        >
          Try Again
        </button>
        <button
          onClick={startNewGame}
          style={{ padding: "0.5rem 1rem" }}
        >
          Start New Game
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>🏆 High Scores</h1>

      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={startNewGame}
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
          Start New Game
        </button>
      </div>

      {scores.length === 0 ? (
        <p style={{ textAlign: "center", fontSize: "18px", color: "#666" }}>
          No games played yet. Be the first to play!
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa" }}>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "left" }}>
                  Player (Guesser)
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "left" }}>
                  Word Setter
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "left" }}>
                  Word/Phrase
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "center" }}>
                  Guesses Used
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "center" }}>
                  Result
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "center" }}>
                  Word Source
                </th>
                <th style={{ padding: "1rem", border: "1px solid #ddd", textAlign: "left" }}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {scores
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((score, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#f9f9f9" : "white" }}>
                    <td style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      fontWeight: "bold"
                    }}>
                      {score.guesserName}
                    </td>
                    <td style={{ padding: "1rem", border: "1px solid #ddd" }}>
                      {score.wordSetterName}
                    </td>
                    <td style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      fontFamily: "monospace",
                      fontWeight: "bold"
                    }}>
                      {score.word}
                    </td>
                    <td style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      textAlign: "center"
                    }}>
                      {score.guesses} / {score.maxGuesses}
                    </td>
                    <td style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      color: score.won ? "#28a745" : "#dc3545",
                      fontWeight: "bold"
                    }}>
                      {score.won ? "✅ Won" : "❌ Lost"}
                    </td>
                    <td style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      textAlign: "center"
                    }}>
                      {score.isWordFromDatabase ? "🎲 Random" : "✏️ Custom"}
                    </td>
                    <td style={{ padding: "1rem", border: "1px solid #ddd" }}>
                      {formatDate(score.timestamp)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {scores.length > 0 && (
        <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f8f9fa", borderRadius: "5px" }}>
          <h3>Statistics</h3>
          <p>Total games played: <strong>{scores.length}</strong></p>
          <p>
            Games won: <strong>{scores.filter(s => s.won).length}</strong>
            ({scores.length > 0 ? Math.round((scores.filter(s => s.won).length / scores.length) * 100) : 0}%)
          </p>
          <p>
            Random words used: <strong>{scores.filter(s => s.isWordFromDatabase).length}</strong>
            ({scores.length > 0 ? Math.round((scores.filter(s => s.isWordFromDatabase).length / scores.length) * 100) : 0}%)
          </p>
        </div>
      )}
    </div>
  );
}