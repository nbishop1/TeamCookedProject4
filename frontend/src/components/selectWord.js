import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket"; // import your shared socket connection

export default function SelectWord() {
  const navigate = useNavigate();
  const [isPlayer1, setIsPlayer1] = useState(false);
  const [word, setWord] = useState("");

  useEffect(() => {
    // Ask server if we are player 1 or player 2
    socket.emit("whoAmI");

    socket.on("youAre", (data) => {
      setIsPlayer1(data.player === 1);
    });

    socket.on("wordChosen", () => {
      navigate("/game");
    });

    return () => {
      socket.off("youAre");
      socket.off("wordChosen");
    };
  }, [navigate]);

  const submitWord = () => {
    if (!word.trim()) return;
    socket.emit("submitWord", word);
  };

  if (!isPlayer1) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Waiting for Player 1 to choose a word...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Player 1: Choose a Word</h1>

      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        style={{ padding: "0.5rem", width: "300px" }}
        placeholder="Enter secret word"
      />

      <button
        onClick={submitWord}
        style={{ padding: "0.5rem 1rem", marginLeft: "1rem" }}
      >
        Submit Word
      </button>
    </div>
  );
}
