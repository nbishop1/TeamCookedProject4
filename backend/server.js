const express = require("express");
const { createServer } = require("http");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { Server } = require("socket.io");

require("dotenv").config({ path: "./config.env" });
const dbo = require("./db/conn");

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// CORS + JSON
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// ----------------------
// SESSION SETUP
// ----------------------
const sessionMiddleware = session({
  secret: "keyboard cat",
  saveUninitialized: false,
  resave: false,
  store: MongoStore.create({ mongoUrl: process.env.ATLAS_URI }),
});
app.use(sessionMiddleware);

// ----------------------
// ROUTES
// ----------------------
app.use(require("./routes/speed"));

// ----------------------
// SOCKET.IO SETUP
// ----------------------
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true
  }
});

// Allow socket to use same session
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ============================
// SPEED GAME LOGIC START
// ============================

// Players + sockets
let players = [];
let sockets = {};
let gameActive = false;

function makeDeck() {
  const suits = ["H", "D", "C", "S"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  let deck = [];
  for (let v of values) {
    for (let s of suits) deck.push(v + s);
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

let game = null;

// Initialize new game
function initGame() {
  const deck = makeDeck();

  game = {
    p1Deck: deck.slice(0, 26),
    p2Deck: deck.slice(26, 52),
    piles: [[], []],
    flipRequested: false
  };

  // Start piles with first card
  game.piles[0].push(game.p1Deck.pop());
  game.piles[1].push(game.p2Deck.pop());
}

// Send game state to both
function broadcastState() {
  const state = {
    piles: game.piles,
    p1Count: game.p1Deck.length,
    p2Count: game.p2Deck.length
  };

  players.forEach(pid => {
    sockets[pid].emit("updateGameState", state);
  });
}

// Valid move check
function isValidMove(card, pileTop) {
  const order = ["A","2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  let v = card.replace(/[HDCS]/, "");
  let t = pileTop.replace(/[HDCS]/, "");

  for (let i = 0; i < order.length; i++) {
    if (order[i] === t) {
      return order[i+1] === v || order[i-1] === v;
    }
  }
  return false;
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // --------------------
  // JOIN GAME
  // --------------------
  socket.on("joinGame", (name) => {
    if (players.length >= 2) {
      socket.emit("error", "Game full");
      return;
    }

    players.push(socket.id);
    sockets[socket.id] = socket;

    // Notify opponent
    players.forEach(pid => {
      if (pid !== socket.id) sockets[pid].emit("opponentJoined", name);
    });

    // Start when two connected
    if (players.length === 2) {
      gameActive = true;
      initGame();
      players.forEach(pid => sockets[pid].emit("startGame"));
    }
  });

  // Client asks for gameState after countdown
  socket.on("requestGameState", () => {
    if (gameActive) broadcastState();
  });

  // --------------------
  // PLAYER MOVE
  // --------------------
  socket.on("playerMove", (move) => {
    if (!gameActive) return;

    let pid = socket.id;
    let isP1 = pid === players[0];

    let deck = isP1 ? game.p1Deck : game.p2Deck;

    // Determine pile
    let pileIndex = move.toPile === "left" ? 0 : 1;
    let pileTop = game.piles[pileIndex][game.piles[pileIndex].length - 1];

    if (!isValidMove(move.cardId, pileTop)) return;

    // Card is valid → place it
    deck.splice(deck.indexOf(move.cardId), 1);
    game.piles[pileIndex].push(move.cardId);

    broadcastState();

    // Win condition
    if (deck.length === 0) {
      endGame(pid);
    }
  });

  // --------------------
  // FLIP LOGIC
  // --------------------
  socket.on("flipSignal", () => {
    if (game.flipRequested) {
      // Both players requested → flip
      if (game.p1Deck.length > 0) game.piles[0].push(game.p1Deck.pop());
      if (game.p2Deck.length > 0) game.piles[1].push(game.p2Deck.pop());

      game.flipRequested = false;
      broadcastState();
    } else {
      game.flipRequested = true;
    }

    // Notify opponent
    players.forEach(pid => {
      if (pid !== socket.id) sockets[pid].emit("flipSignal");
    });
  });

  // --------------------
  // SAVE RESULT (Mongo)
  // --------------------
  socket.on("saveResult", async (data) => {
    try {
      const db = dbo.getDb();
      await db.collection("speedResults").insertOne(data);

      let past = await db.collection("speedResults")
                        .find({ name: data.name }).toArray();

      socket.emit("pastResults", past);
    } catch (err) {
      console.error("Mongo save error:", err);
    }
  });

  // --------------------
  // DISCONNECT
  // --------------------
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    players = players.filter(p => p !== socket.id);
    delete sockets[socket.id];

    if (players.length < 2) {
      gameActive = false;
    }
  });
});

// --------------------
// FINISH GAME
// --------------------
function endGame(winnerID) {
  let loserID = players.find(p => p !== winnerID);
  let loserRemaining = loserID === players[0]
    ? game.p1Deck.length
    : game.p2Deck.length;

  players.forEach(pid => {
    sockets[pid].emit("gameOver", {
      winner: winnerID,
      remaining: loserRemaining
    });
  });

  gameActive = false;
}

// --------------------
// START SERVER
// --------------------
server.listen(port, () => {
  dbo.connectToServer((err) => { if (err) console.error(err); });
  console.log("Server running on port", port);
});
