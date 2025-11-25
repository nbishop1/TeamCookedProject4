import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function SelectWord() {
  const navigate = useNavigate();
  const [isWordSetter, setIsWordSetter] = useState(false);
  const [word, setWord] = useState("");
  const [players, setPlayers] = useState({ p1: "", p2: "" });
  const [currentWordSetter, setCurrentWordSetter] = useState("");
  const [waitingMessage, setWaitingMessage] = useState("");

  useEffect(() => {
    socket.emit("whoAmI");

    socket.on("youAre", (data) => {
      setIsWordSetter(data.player === 1);
    });

    socket.on("startSelectWord", (data) => {
      setPlayers(data.players);
      setCurrentWordSetter(data.currentWordSetter);
      setWaitingMessage(`Waiting for ${data.currentWordSetter} to choose a word...`);
    });

    socket.on("nextRound", (data) => {
      setCurrentWordSetter(data.newWordSetter);
      setWaitingMessage(`Waiting for ${data.newWordSetter} to choose a word...`);
      // Check if current user is the new word setter
      socket.emit("whoAmI");
    });

    socket.on("startGame", () => navigate("/game"));

    return () => {
      socket.off("youAre");
      socket.off("startSelectWord");
      socket.off("nextRound");
      socket.off("startGame");
    };
  }, [navigate]);

  const submitCustomWord = () => {
    if (!word.trim()) return;
    socket.emit("submitWord", { type: "custom", word: word.trim() });
  };

  const requestRandomWord = () => {
    socket.emit("submitWord", { type: "random" });
  };

  if (!isWordSetter) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>{waitingMessage}</h2>
        <p>Players: {players.p1} vs {players.p2}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{currentWordSetter}: Choose a Word</h1>
      <p>Players: {players.p1} vs {players.p2}</p>

      <div style={{ marginBottom: "2rem" }}>
        <h3>Option 1: Enter a Custom Word</h3>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter secret word"
          style={{ padding: "0.5rem", marginRight: "0.5rem", fontSize: "16px" }}
        />
        <button
          onClick={submitCustomWord}
          style={{ padding: "0.5rem 1rem", fontSize: "16px" }}
        >
          Submit Custom Word
        </button>
      </div>

      <div>
        <h3>Option 2: Use Random Word from Database</h3>
        <button
          onClick={requestRandomWord}
          style={{ padding: "0.5rem 1rem", fontSize: "16px" }}
        >
          Get Random Word
        </button>
      </div>
    </div>
  );
}
