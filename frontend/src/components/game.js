import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function Game() {
  const navigate = useNavigate();
  const [blanks, setBlanks] = useState([]);
  const [guess, setGuess] = useState("");
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [maxAttempts, setMaxAttempts] = useState(6);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [isGuesser, setIsGuesser] = useState(false);
  const [guesserName, setGuesserName] = useState("");
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => {
    socket.emit("whoAmI");

    socket.on("youAre", (data) => setIsGuesser(data.player === 2));

    socket.on("startGame", ({ wordLength, guesserName }) => {
      setBlanks(Array(wordLength).fill("_"));
      setGuessedLetters([]);
      setWrongAttempts(0);
      setMaxAttempts(6);
      setGuesserName(guesserName);
      setGameEnded(false);
      setGameResult(null);
    });

    socket.on("letterResult", ({ letter, correct, currentWord, wrongAttempts: serverWrongAttempts }) => {
      setBlanks(currentWord);
      setWrongAttempts(serverWrongAttempts);
      setGuessedLetters((prev) => [...prev, letter]);
    });

    socket.on("gameEnded", (result) => {
      setGameEnded(true);
      setGameResult(result);
      console.log("Game ended:", result);
    });

    socket.on("nextRound", () => {
      // Wait a moment then navigate to select word for next round
      setTimeout(() => {
        navigate("/selectWord");
      }, 1000);
    });

    socket.on("showHighScores", () => {
      navigate("/highScores");
    });

    socket.on("reset", (message) => {
      alert(message);
      navigate("/");
    });

    return () => {
      socket.off("youAre");
      socket.off("startGame");
      socket.off("letterResult");
      socket.off("gameEnded");
      socket.off("nextRound");
      socket.off("showHighScores");
      socket.off("reset");
    };
  }, [navigate]);

  const submitGuess = () => {
    const letter = guess.trim().toLowerCase();
    if (!letter || guessedLetters.includes(letter) || !isGuesser || gameEnded) return;
    socket.emit("guessLetter", letter);
    setGuess("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      submitGuess();
    }
  };

  // Draw simple hangman
  const drawHangman = () => {
    const parts = [
      "  +---+",
      "  |   |",
      wrongAttempts >= 1 ? "  O   |" : "      |",
      wrongAttempts >= 3 ? " /|\\  |" : wrongAttempts >= 2 ? " /|   |" : wrongAttempts >= 1 ? "  |   |" : "      |",
      wrongAttempts >= 5 ? " / \\  |" : wrongAttempts >= 4 ? " /    |" : "      |",
      "      |",
      "========='"
    ];
    return parts.join("\n");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Hangman Game</h1>

      {gameEnded && gameResult && (
        <div style={{
          backgroundColor: gameResult.gameWon ? "#d4edda" : "#f8d7da",
          border: `1px solid ${gameResult.gameWon ? "#c3e6cb" : "#f5c6cb"}`,
          padding: "1rem",
          borderRadius: "5px",
          marginBottom: "2rem"
        }}>
          <h2>{gameResult.gameWon ? "🎉 Congratulations!" : "💀 Game Over!"}</h2>
          <p>
            <strong>{gameResult.guesserName}</strong> {gameResult.gameWon ? "successfully guessed" : "failed to guess"}
            the word: <strong>"{gameResult.secretWord}"</strong>
          </p>
          <p>Wrong attempts: {gameResult.wrongAttempts} / 6</p>
          {gameResult.round < 2 && <p>Preparing for Round {gameResult.round + 1}...</p>}
          {gameResult.round >= 2 && <p>Both rounds completed! Viewing high scores...</p>}
        </div>
      )}

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2>Word: {blanks.join(" ")}</h2>
          <p>Guesser: <strong>{guesserName}</strong></p>
          <p style={{ color: wrongAttempts >= maxAttempts ? "red" : "inherit" }}>
            Wrong attempts: {wrongAttempts} / {maxAttempts}
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={1}
              placeholder="Enter a letter"
              style={{
                marginRight: "0.5rem",
                padding: "0.5rem",
                fontSize: "16px",
                textTransform: "uppercase"
              }}
              disabled={!isGuesser || gameEnded}
            />
            <button
              onClick={submitGuess}
              disabled={!isGuesser || gameEnded}
              style={{ padding: "0.5rem 1rem", fontSize: "16px" }}
            >
              Guess
            </button>
          </div>

          {!isGuesser && !gameEnded && (
            <p style={{ fontStyle: "italic" }}>You're watching {guesserName} guess...</p>
          )}

          <div>
            <strong>Guessed letters:</strong>
            <div style={{ marginTop: "0.5rem" }}>
              {guessedLetters.map((letter, index) => (
                <span
                  key={index}
                  style={{
                    display: "inline-block",
                    margin: "0.2rem",
                    padding: "0.3rem 0.6rem",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "3px"
                  }}
                >
                  {letter.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 200px" }}>
          <h3>Hangman</h3>
          <pre style={{
            fontFamily: "monospace",
            fontSize: "14px",
            backgroundColor: "#f5f5f5",
            padding: "1rem",
            border: "1px solid #ddd",
            borderRadius: "5px"
          }}>
            {drawHangman()}
          </pre>
        </div>
      </div>
    </div>
  );
}
