import React from "react";
import { Route, Routes } from "react-router-dom";
import SetName from "./components/setName";
import Game from "./components/game";
import HighScores from "./components/highScores";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<SetName />} />
        <Route path="/game" element={<Game />} />
        <Route path="/results" element={<HighScores />} />
      </Routes>
    </div>
  );
}

export default App;
