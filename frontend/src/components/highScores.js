import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function HighScores() {
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    // Get data passed from game component
    if (location.state?.results) {
      setResults(location.state.results);
      setWinner(location.state.winner);
    }
  }, [location]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1e3c72, #2a5298)",
      fontFamily: "Arial, sans-serif",
      padding: "20px",
      color: "white"
    }}>
      <div style={{
        maxWidth: "800px",
        margin: "0 auto",
        textAlign: "center"
      }}>
        <h1 style={{ fontSize: "3em", marginBottom: "30px" }}>
          Game History
        </h1>

        {winner && (
          <div style={{
            background: "rgba(255,255,255,0.1)",
            padding: "20px",
            borderRadius: "15px",
            marginBottom: "30px",
            backdropFilter: "blur(10px)"
          }}>
            <h2 style={{ color: "#4CAF50", marginBottom: "10px" }}>
              🏆 {winner.winner}'s Wins 🏆
            </h2>
            <p style={{ fontSize: "1.1em" }}>
              Total games won: {results.length}
            </p>
          </div>
        )}

        {results.length > 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "15px",
            padding: "20px",
            backdropFilter: "blur(10px)"
          }}>
            <h3 style={{ marginBottom: "20px", fontSize: "1.5em" }}>
              Previous Games
            </h3>

            <div style={{
              display: "grid",
              gap: "15px"
            }}>
              {results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    padding: "15px",
                    borderRadius: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: "bold", fontSize: "1.1em", color: "#4CAF50" }}>
                      {result.winner} defeated {result.loser}
                    </div>
                    <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                      {result.loser} had {result.loserRemainingCards} cards remaining
                    </div>
                  </div>
                  <div style={{
                    fontSize: "0.9em",
                    opacity: 0.7,
                    textAlign: "right"
                  }}>
                    {formatDate(result.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: "rgba(255,255,255,0.1)",
            padding: "40px",
            borderRadius: "15px",
            backdropFilter: "blur(10px)"
          }}>
            <h3 style={{ fontSize: "1.5em", marginBottom: "20px" }}>
              No game history available
            </h3>
            <p style={{ fontSize: "1.1em", opacity: 0.8 }}>
              Play some games to see your results here!
            </p>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: "30px",
            padding: "15px 30px",
            fontSize: "1.2em",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "background-color 0.3s"
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = "#45a049"}
          onMouseOut={(e) => e.target.style.backgroundColor = "#4CAF50"}
        >
          Play New Game
        </button>
      </div>
    </div>
  );
}