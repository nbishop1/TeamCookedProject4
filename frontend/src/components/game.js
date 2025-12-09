import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function Game() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [pastResults, setPastResults] = useState([]);
  const [stalemateStatus, setStalemateStatus] = useState({ p1Ready: false, p2Ready: false, message: "" });

  // Got scaffolding for card generation from ChatGPT
  // Card value mapping for display
  const getCardDisplay = (card) => {
    if (!card) return '';
    return card.replace('H', '♥').replace('D', '♦').replace('C', '♣').replace('S', '♠');
  };

  // Get card color for display
  const getCardColor = (card) => {
    if (!card) return '#000';
    return card.includes('H') || card.includes('D') ? '#dc2626' : '#000';
  };

  useEffect(() => {
    console.log("Game component mounted, setting up socket listeners");

    // Request current game state when component mounts
    socket.emit("requestGameState");

    // Game state updates
    socket.on("updateGameState", (state) => {
      console.log("Received updateGameState:", state);
      setGameState(state);
      setMyHand(state.myHand || []);
      setMyPlayerIndex(state.myPlayerIndex);
    });

    // Game over
    socket.on("gameOver", (result) => {
      console.log("Game over:", result);
      setGameEnded(true);
      setWinner(result);
    });

    // Past results for winner
    socket.on("pastResults", (results) => {
      setPastResults(results);
    });

    // Stalemate status updates
    socket.on("stalemateStatus", (status) => {
      setStalemateStatus(status);
    });

    // Stalemate resolved
    socket.on("stalemateResolved", () => {
      setStalemateStatus({ p1Ready: false, p2Ready: false, message: "Cards reshuffled!" });
      setTimeout(() => setStalemateStatus({ p1Ready: false, p2Ready: false, message: "" }), 3000);
    });

    // Opponent declared stalemate
    socket.on("opponentDeclaredStalemate", () => {
      setStalemateStatus(prev => ({ ...prev, message: "Opponent wants to reshuffle. Click 'Agree to Reshuffle' to confirm." }));
    });

    // Player disconnected
    socket.on("playerDisconnected", () => {
      alert("Other player disconnected!");
      navigate("/");
    });

    return () => {
      socket.off("updateGameState");
      socket.off("gameOver");
      socket.off("pastResults");
      socket.off("stalemateStatus");
      socket.off("stalemateResolved");
      socket.off("opponentDeclaredStalemate");
      socket.off("playerDisconnected");
    };
  }, [navigate]);

  // Handle card drag start
  const handleDragStart = useCallback((e, card) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // Handle drop on center pile
  const handleDrop = useCallback((e, pileIndex) => {
    e.preventDefault();
    if (!draggedCard || gameEnded) return;

    socket.emit("playerMove", {
      card: draggedCard,
      centerPile: pileIndex
    });

    setDraggedCard(null);
  }, [draggedCard, gameEnded]);

  // Allow drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Declare stalemate
  const handleStalemate = () => {
    socket.emit("declareStalemate");
  };

  // Show results page
  const showResults = () => {
    navigate("/results", { state: { results: pastResults, winner } });
  };

  if (gameEnded) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "linear-gradient(135deg, #1e3c72, #2a5298)",
        color: "white",
        textAlign: "center"
      }}>
        <h1 style={{ fontSize: "3em", marginBottom: "20px" }}>Game Over!</h1>

        <div style={{
          background: "rgba(255,255,255,0.1)",
          padding: "30px",
          borderRadius: "15px",
          backdropFilter: "blur(10px)",
          minWidth: "400px"
        }}>
          <h2 style={{
            fontSize: "2em",
            color: winner?.yourResult === 'win' ? '#4CAF50' : '#f44336',
            marginBottom: "20px"
          }}>
            {winner?.yourResult === 'win' ? ' You Win! ' : ' You Lose '}
          </h2>

          <p style={{ fontSize: "1.3em", marginBottom: "10px" }}>
            Winner: <strong>{winner?.winner}</strong>
          </p>
          <p style={{ fontSize: "1.1em", marginBottom: "20px" }}>
            {winner?.loser} had {winner?.loserRemainingCards} cards remaining
          </p>

          {pastResults.length > 0 && (
            <button
              onClick={showResults}
              style={{
                padding: "12px 30px",
                fontSize: "1.1em",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                marginRight: "10px"
              }}
            >
              View Past Games
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            style={{
              padding: "12px 30px",
              fontSize: "1.1em",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            New Game
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    console.log("Game state is null, showing loading...");
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontSize: "1.5em"
      }}>
        Loading game...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f4c3a, #2d8659)",
      fontFamily: "Arial, sans-serif",
      padding: "20px",
      color: "white"
    }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px", fontSize: "2.5em" }}>
        Speed Card Game
      </h1>

      {/* Game Board */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gap: "20px",
        maxWidth: "1200px",
        margin: "0 auto",
        alignItems: "start"
      }}>

        {/* Player 1 Area */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          padding: "15px",
          borderRadius: "10px",
          textAlign: "center"
        }}>
          <h3>Player 1</h3>
          <p>Hand: {gameState.p1HandCount} cards</p>
          <p>Side Piles: {gameState.p1SidePileCount} cards</p>
          <p>Main Deck: {gameState.p1MainDeckCount} cards</p>
          <div style={{
            fontSize: "2em",
            fontWeight: "bold",
            color: gameState.p1HandCount + gameState.p1SidePileCount + gameState.p1MainDeckCount === 0 ? '#4CAF50' : 'white'
          }}>
            Total: {gameState.p1HandCount + gameState.p1SidePileCount + gameState.p1MainDeckCount}
          </div>
        </div>

        {/* Center Play Area */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px"
        }}>
          {/* Center Piles */}
          <div style={{
            display: "flex",
            gap: "40px",
            justifyContent: "center"
          }}>
            {/* Left Center Pile */}
            <div
              style={{
                width: "100px",
                height: "140px",
                border: "3px dashed #fff",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.1)",
                position: "relative"
              }}
              onDrop={(e) => handleDrop(e, 0)}
              onDragOver={handleDragOver}
            >
              {gameState.centerPiles?.[0]?.length > 0 && (
                <div style={{
                  width: "90px",
                  height: "130px",
                  background: "white",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2em",
                  fontWeight: "bold",
                  color: getCardColor(gameState.centerPiles[0][gameState.centerPiles[0].length - 1]),
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
                }}>
                  {getCardDisplay(gameState.centerPiles[0][gameState.centerPiles[0].length - 1])}
                </div>
              )}
            </div>

            {/* Right Center Pile */}
            <div
              style={{
                width: "100px",
                height: "140px",
                border: "3px dashed #fff",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.1)",
                position: "relative"
              }}
              onDrop={(e) => handleDrop(e, 1)}
              onDragOver={handleDragOver}
            >
              {gameState.centerPiles?.[1]?.length > 0 && (
                <div style={{
                  width: "90px",
                  height: "130px",
                  background: "white",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2em",
                  fontWeight: "bold",
                  color: getCardColor(gameState.centerPiles[1][gameState.centerPiles[1].length - 1]),
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
                }}>
                  {getCardDisplay(gameState.centerPiles[1][gameState.centerPiles[1].length - 1])}
                </div>
              )}
            </div>
          </div>

          {/* Stalemate Status & Actions */}
          {stalemateStatus.message && (
            <div style={{
              background: "rgba(255, 193, 7, 0.9)",
              color: "#000",
              padding: "10px 15px",
              borderRadius: "8px",
              textAlign: "center",
              fontWeight: "bold",
              marginBottom: "10px",
              maxWidth: "300px"
            }}>
              {stalemateStatus.message}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", flexDirection: "column", alignItems: "center" }}>
            {stalemateStatus.p1Ready || stalemateStatus.p2Ready ? (
              <button
                onClick={handleStalemate}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "1em",
                  fontWeight: "bold"
                }}
              >
                Agree to Reshuffle
              </button>
            ) : (
              <button
                onClick={handleStalemate}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "1em",
                  fontWeight: "bold"
                }}
              >
                Request Reshuffle
              </button>
            )}

            {/* Visual indicator of stalemate status */}
            <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
              {stalemateStatus.p1Ready && stalemateStatus.p2Ready ? "Both players ready - reshuffling..." :
                stalemateStatus.p1Ready || stalemateStatus.p2Ready ? "Waiting for other player..." :
                  "No reshuffle requested"}
            </div>
          </div>
        </div>

        {/* Player 2 Area */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          padding: "15px",
          borderRadius: "10px",
          textAlign: "center"
        }}>
          <h3>Player 2</h3>
          <p>Hand: {gameState.p2HandCount} cards</p>
          <p>Side Piles: {gameState.p2SidePileCount} cards</p>
          <p>Main Deck: {gameState.p2MainDeckCount} cards</p>
          <div style={{
            fontSize: "2em",
            fontWeight: "bold",
            color: gameState.p2HandCount + gameState.p2SidePileCount + gameState.p2MainDeckCount === 0 ? '#4CAF50' : 'white'
          }}>
            Total: {gameState.p2HandCount + gameState.p2SidePileCount + gameState.p2MainDeckCount}
          </div>
        </div>
      </div>

      {/* Your Hand */}
      <div style={{
        marginTop: "40px",
        textAlign: "center"
      }}>
        <h3 style={{ marginBottom: "15px" }}>
          Your Hand (Player {myPlayerIndex + 1})
        </h3>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}>
          {myHand.map((card, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, card)}
              style={{
                width: "70px",
                height: "100px",
                background: "white",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1em",
                fontWeight: "bold",
                color: getCardColor(card),
                cursor: "grab",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                transition: "transform 0.2s",
                border: "2px solid #ddd"
              }}
              onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
              onMouseOut={(e) => e.target.style.transform = "scale(1)"}
            >
              {getCardDisplay(card)}
            </div>
          ))}
        </div>

        {myHand.length === 0 && (
          <p style={{ fontSize: "1.2em", color: "#4CAF50", fontWeight: "bold", marginTop: "20px" }}>
             All cards played! Waiting for game to end... 
          </p>
        )}
      </div>

      <div style={{
        textAlign: "center",
        marginTop: "20px",
        fontSize: "0.9em",
        color: "rgba(255,255,255,0.7)"
      }}>
        Drag cards from your hand to the center piles. Cards must be one higher or lower than the top card.
      </div>
    </div>
  );
}
