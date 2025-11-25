const express = require("express");
const { createServer } = require("http"); // Needed for Socket.IO
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { Server } = require("socket.io");

require("dotenv").config({ path: "./config.env" });

const app = express();
const port = process.env.PORT || 3001;

// Create HTTP server from Express app
const server = createServer(app);

// CORS & JSON middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Session middleware
const sessionMiddleware = session({
  secret: "keyboard cat",
  saveUninitialized: false,
  resave: false,
  store: MongoStore.create({ mongoUrl: process.env.ATLAS_URI }),
});
app.use(sessionMiddleware);

// Import your DB connection
const dbo = require("./db/conn");

// Routes
app.use(require("./routes/session"));
app.use(require("./routes/hangman"));

app.get("/", (req, res) => {
  res.send("Hello, World");
});

// ----- SOCKET.IO SETUP -----  Used Google and Chatgpt to help build this connection to socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Wrap express-session so Socket.IO can use it
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

let players = {
  player1: null, // socket.id
  player2: null, // socket.id
};

let names = {}; // socket.id → name
let round = 0;
let secretWord = null;
let currentWord = [];
let wrongAttempts = 0;
let maxAttempts = 6;
let gameResults = []; // Store results for each round
let currentGuesser = null; // Track who is guessing
let currentWordSetter = null; // Track who set the word
let isWordFromDatabase = false; // Track if word came from database

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Assign players
  socket.on("submitName", (name) => {
    names[socket.id] = name;
    console.log("User connected:", name);

    if (!players.player1) {
      players.player1 = socket.id;
      currentWordSetter = socket.id;
    } else if (!players.player2) {
      players.player2 = socket.id;
      currentGuesser = socket.id;
    }

    if (players.player1 && players.player2) {
      console.log("both users connected");
      io.emit("startSelectWord", {
        players: {
          p1: names[players.player1],
          p2: names[players.player2],
        },
        currentWordSetter: names[currentWordSetter]
      });
    } else {
      socket.emit("waiting", "Waiting for the other player...");
    }
  });

  // Who is who
  socket.on("whoAmI", () => {
    if (socket.id === players.player1) socket.emit("youAre", { player: 1 });
    else socket.emit("youAre", { player: 2 });
  });

  // Player submits word (custom or requests random)
  socket.on("submitWord", (data) => {
    console.log("Word submission:", data);
    if (socket.id !== currentWordSetter) return;

    if (data.type === "custom") {
      secretWord = data.word.toLowerCase();
      isWordFromDatabase = false;
    } else if (data.type === "random") {
      // Get random word from database
      getRandomWord().then(word => {
        secretWord = word.toLowerCase();
        isWordFromDatabase = true;
        startGame();
      }).catch(err => {
        console.error("Error getting random word:", err);
        // Fallback to a default word
        secretWord = "javascript";
        isWordFromDatabase = true;
        startGame();
      });
      return;
    }

    startGame();
  });

  function startGame() {
    currentWord = Array(secretWord.length).fill("_");
    console.log("Game starting with word:", secretWord);
    io.emit("startGame", {
      wordLength: secretWord.length,
      guesserName: names[currentGuesser]
    });
  }

  // Player guesses a letter
  socket.on("guessLetter", (letter) => {
    console.log(
      "Letter guessed:",
      letter,
      "by:", names[socket.id],
      "Current guesser:", names[currentGuesser]
    );
    if (socket.id !== currentGuesser) return;

    letter = letter.toLowerCase();
    let correct = false;

    for (let i = 0; i < secretWord.length; i++) {
      if (secretWord[i] === letter) {
        currentWord[i] = letter;
        correct = true;
      }
    }

    if (!correct) {
      wrongAttempts++;
    }

    // Emit to both players
    io.emit("letterResult", {
      letter,
      correct,
      currentWord,
      wrongAttempts,
      maxAttempts
    });

    // Check if game ended
    const gameWon = !currentWord.includes("_");
    const gameLost = wrongAttempts >= maxAttempts;

    if (gameWon || gameLost) {
      console.log("Game Ended - Won:", gameWon);

      // Store game result
      const result = {
        guesserName: names[currentGuesser],
        wordSetterName: names[currentWordSetter],
        word: secretWord,
        guesses: wrongAttempts,
        maxGuesses: maxAttempts,
        won: gameWon,
        isWordFromDatabase: isWordFromDatabase,
        timestamp: new Date()
      };
      gameResults.push(result);

      round++;

      // Emit game end with result
      io.emit("gameEnded", {
        gameWon,
        secretWord,
        wrongAttempts,
        guesserName: names[currentGuesser],
        round: round
      });

      if (round >= 2) {
        console.log("Both rounds completed");
        // Save results to database and show high scores
        saveGameResults(gameResults).then(() => {
          io.emit("showHighScores");
        });
        // Reset for next session
        resetGameState();
        return;
      }

      // Prepare for next round - rotate players
      setTimeout(() => {
        [players.player1, players.player2] = [players.player2, players.player1];
        currentGuesser = players.player2;
        currentWordSetter = players.player1;
        secretWord = null;
        currentWord = [];
        wrongAttempts = 0;
        isWordFromDatabase = false;

        io.emit("nextRound", {
          newWordSetter: names[players.player1],
          newGuesser: names[players.player2]
        });
      }, 3000); // 3 second delay to show results
    }
  });

  // Disconnect logic
  socket.on("disconnect", () => {
    if (players.player1 === socket.id || players.player2 === socket.id) {
      resetGameState();
      console.log("User Disconnected");
      io.emit("reset", "A player disconnected. Restarting game...");
    }
  });
});

// Helper functions
function resetGameState() {
  players = { player1: null, player2: null };
  names = {};
  secretWord = null;
  currentWord = [];
  wrongAttempts = 0;
  round = 0;
  gameResults = [];
  currentGuesser = null;
  currentWordSetter = null;
  isWordFromDatabase = false;
}

async function getRandomWord() {
  try {
    const db_connect = dbo.getDb();
    const words = await db_connect.collection("words").aggregate([
      { $sample: { size: 1 } }
    ]).toArray();

    if (words.length > 0) {
      return words[0].word;
    } else {
      // If no words in database, return a default
      return "hangman";
    }
  } catch (error) {
    console.error("Error fetching random word:", error);
    return "hangman";
  }
}

async function saveGameResults(results) {
  try {
    const db_connect = dbo.getDb();
    await db_connect.collection("hangmanScores").insertMany(results);
    console.log("Game results saved to database");
  } catch (error) {
    console.error("Error saving game results:", error);
  }
}

// Start server and connect to MongoDB
server.listen(port, () => {
  dbo.connectToServer((err) => {
    if (err) console.error(err);
  });
  console.log(`Server is running on port ${port}`);
});
