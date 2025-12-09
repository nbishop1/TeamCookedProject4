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

// Players + sockets + game state
let players = [];
let sockets = {};
let playerNames = {};
let gameActive = false;
let gameState = 'waiting'; // 'waiting', 'countdown', 'playing', 'ended'
let countdownTimer = null;

function makeDeck() {
  const suits = ["H", "D", "C", "S"];
  const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

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

// Initialize new game for Speed
function initGame() {
  const deck = makeDeck();

  // Deal 26 cards to each player
  // Each player gets: 5 hand + 15 draw deck + 4 side piles (5 cards each) + 1 center card
  const p1Cards = deck.slice(0, 26);
  const p2Cards = deck.slice(26, 52);

  game = {
    // Player 1 setup
    p1Hand: p1Cards.slice(0, 5),        // 5 cards in hand
    p1SidePiles: [
      p1Cards.slice(5, 10),             // Side pile 1: 5 cards
      p1Cards.slice(10, 15),            // Side pile 2: 5 cards 
      p1Cards.slice(15, 20),            // Side pile 3: 5 cards
      p1Cards.slice(20, 25)             // Side pile 4: 5 cards
    ],
    p1MainDeck: [],                     // Will be filled from side piles during play

    // Player 2 setup  
    p2Hand: p2Cards.slice(0, 5),        // 5 cards in hand
    p2SidePiles: [
      p2Cards.slice(5, 10),             // Side pile 1: 5 cards
      p2Cards.slice(10, 15),            // Side pile 2: 5 cards
      p2Cards.slice(15, 20),            // Side pile 3: 5 cards
      p2Cards.slice(20, 25)             // Side pile 4: 5 cards
    ],
    p2MainDeck: [],                     // Will be filled from side piles during play

    // Center piles - each gets one card to start
    centerPiles: [
      [p1Cards[25]],  // Left center pile starts with p1's center card
      [p2Cards[25]]   // Right center pile starts with p2's center card
    ],

    stalemate: {
      p1Ready: false,
      p2Ready: false
    }
  };
}

// Send game state to both players
function broadcastState() {
  if (!game) {
    console.error("Cannot broadcast state: game is null");
    return;
  }

  console.log("Broadcasting game state...");
  const state = {
    centerPiles: game.centerPiles,
    p1HandCount: game.p1Hand.length,
    p2HandCount: game.p2Hand.length,
    p1SidePileCount: game.p1SidePiles.reduce((total, pile) => total + pile.length, 0),
    p2SidePileCount: game.p2SidePiles.reduce((total, pile) => total + pile.length, 0),
    p1MainDeckCount: game.p1MainDeck.length,
    p2MainDeckCount: game.p2MainDeck.length,
    gameState: gameState
  };

  // Send personalized state to each player
  console.log("Players array:", players);
  console.log("Available socket IDs:", Object.keys(sockets));

  if (players[0] && sockets[players[0]]) {
    const p1State = {
      ...state,
      myHand: game.p1Hand,
      myPlayerIndex: 0
    };
    console.log("Sending to Player 1:", players[0], "State keys:", Object.keys(p1State));
    sockets[players[0]].emit("updateGameState", p1State);
  } else {
    console.log("Player 1 socket not found - players[0]:", players[0], "socket exists:", !!sockets[players[0]]);
  }

  if (players[1] && sockets[players[1]]) {
    const p2State = {
      ...state,
      myHand: game.p2Hand,
      myPlayerIndex: 1
    };
    console.log("Sending to Player 2:", players[1], "State keys:", Object.keys(p2State));
    sockets[players[1]].emit("updateGameState", p2State);
  } else {
    console.log("Player 2 socket not found - players[1]:", players[1], "socket exists:", !!sockets[players[1]]);
  }
}

// Check if card can be played on center pile
function isValidMove(card, pileTop) {
  const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const cardValue = card.replace(/[HDCS]/, "");
  const topValue = pileTop.replace(/[HDCS]/, "");

  const cardIndex = values.indexOf(cardValue);
  const topIndex = values.indexOf(topValue);

  // Can play if one higher or one lower (with wrapping)
  return Math.abs(cardIndex - topIndex) === 1 ||
    (cardIndex === 0 && topIndex === 12) ||
    (cardIndex === 12 && topIndex === 0);
}

// Handle stalemate - add new cards from side piles
function handleStalemate() {
  if (game.stalemate.p1Ready && game.stalemate.p2Ready) {
    console.log("Both players agreed to stalemate, resolving...");

    // Check if players have cards in their side piles to add
    let p1HasSideCards = game.p1SidePiles.some(pile => pile.length > 0);
    let p2HasSideCards = game.p2SidePiles.some(pile => pile.length > 0);

    // If both players have side pile cards, add new cards to center
    if (p1HasSideCards && p2HasSideCards) {
      // Each player adds one card from their side piles to the center
      let p1NewCard = null;
      let p2NewCard = null;

      // Get card from Player 1's side piles (find first non-empty pile)
      for (let i = 0; i < game.p1SidePiles.length; i++) {
        if (game.p1SidePiles[i].length > 0) {
          p1NewCard = game.p1SidePiles[i].pop();
          break;
        }
      }

      // Get card from Player 2's side piles (find first non-empty pile)
      for (let i = 0; i < game.p2SidePiles.length; i++) {
        if (game.p2SidePiles[i].length > 0) {
          p2NewCard = game.p2SidePiles[i].pop();
          break;
        }
      }

      // Add new cards to center piles
      if (p1NewCard) game.centerPiles[0].push(p1NewCard);
      if (p2NewCard) game.centerPiles[1].push(p2NewCard);

      console.log("Added new cards to center:", p1NewCard, p2NewCard);
    } else {
      // If no side pile cards available, just shuffle existing center cards as fallback
      console.log("No side pile cards available, shuffling existing center cards");
      const allCenterCards = [...game.centerPiles[0], ...game.centerPiles[1]];

      // Shuffle the center cards
      for (let i = allCenterCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCenterCards[i], allCenterCards[j]] = [allCenterCards[j], allCenterCards[i]];
      }

      // Reset center piles with shuffled cards
      game.centerPiles[0] = [allCenterCards[0]];
      game.centerPiles[1] = [allCenterCards[1]];
    }

    // Reset stalemate flags
    game.stalemate.p1Ready = false;
    game.stalemate.p2Ready = false;

    broadcastState();

    // Notify players of reset with updated status
    const resetStatus = {
      p1Ready: false,
      p2Ready: false,
      message: "New cards added to center piles!"
    };

    players.forEach(pid => {
      sockets[pid].emit("stalemateResolved");
      sockets[pid].emit("stalemateStatus", resetStatus);
    });
  }
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // --------------------
  // JOIN GAME WITH NAME
  // --------------------
  socket.on("joinGame", (name) => {
    console.log(`Player ${name} trying to join. Current players:`, players.length);

    if (players.length >= 2) {
      socket.emit("error", "Game full");
      return;
    }

    players.push(socket.id);
    sockets[socket.id] = socket;
    playerNames[socket.id] = name;

    console.log(`Player ${name} joined as player ${players.length}`);

    socket.emit("playerJoined", {
      playerIndex: players.length - 1,
      name: name
    });

    // Notify other player that someone joined
    if (players.length === 1) {
      socket.emit("waitingForPlayer");
      console.log("Waiting for second player");
    } else if (players.length === 2) {
      // Both players ready, start countdown
      gameState = 'countdown';
      console.log("Both players ready, starting countdown");

      players.forEach((pid, index) => {
        sockets[pid].emit("bothPlayersReady", {
          player1Name: playerNames[players[0]],
          player2Name: playerNames[players[1]],
          yourIndex: index
        });
      });

      startCountdown();
    }
  });

  // Start 3-second countdown
  function startCountdown() {
    let count = 3;

    const countdown = setInterval(() => {
      players.forEach(pid => {
        sockets[pid].emit("countdown", count);
      });

      count--;

      if (count < 0) {
        clearInterval(countdown);
        startGame();
      }
    }, 1000);
  }

  function startGame() {
    gameState = 'playing';
    gameActive = true;
    console.log("Starting game...");
    initGame();
    console.log("Game initialized, broadcasting to players:", players.length);

    players.forEach(pid => {
      sockets[pid].emit("gameStarted");
    });

    broadcastState();
    console.log("Game state broadcasted");
  }

  // --------------------
  // REQUEST GAME STATE
  // --------------------
  socket.on("requestGameState", () => {
    console.log("Player", socket.id, "requested game state");
    if (game && gameActive) {
      const playerIndex = players.indexOf(socket.id);
      if (playerIndex !== -1) {
        broadcastState();
      }
    }
  });

  // --------------------
  // PLAYER MOVE
  // --------------------
  socket.on("playerMove", (move) => {
    if (!gameActive || gameState !== 'playing') return;

    const playerIndex = players.indexOf(socket.id);
    if (playerIndex === -1) return;

    const isP1 = playerIndex === 0;
    const hand = isP1 ? game.p1Hand : game.p2Hand;
    const centerPileIndex = move.centerPile; // 0 for left, 1 for right

    // Check if card is in player's hand
    const cardIndex = hand.indexOf(move.card);
    if (cardIndex === -1) return;

    // Check if move is valid
    const centerPile = game.centerPiles[centerPileIndex];
    const topCard = centerPile[centerPile.length - 1];

    if (!isValidMove(move.card, topCard)) return;

    // Valid move - remove from hand and add to center pile
    hand.splice(cardIndex, 1);
    centerPile.push(move.card);

    // Refill hand from side piles if available
    const sidePiles = isP1 ? game.p1SidePiles : game.p2SidePiles;

    // Keep hand at 5 cards by drawing from side piles
    while (hand.length < 5) {
      let cardDrawn = false;
      for (let pile of sidePiles) {
        if (pile.length > 0) {
          hand.push(pile.shift());
          cardDrawn = true;
          break;
        }
      }
      if (!cardDrawn) break; // No more cards available
    }

    broadcastState();

    // Check win condition - player wins when they have no cards left
    const totalSideCards = sidePiles.reduce((total, pile) => total + pile.length, 0);
    if (hand.length === 0 && totalSideCards === 0) {
      endGame(socket.id);
    }
  });

  // --------------------
  // STALEMATE HANDLING
  // --------------------
  socket.on("declareStalemate", () => {
    if (!gameActive || gameState !== 'playing') return;

    const playerIndex = players.indexOf(socket.id);
    if (playerIndex === 0) {
      game.stalemate.p1Ready = true;
    } else if (playerIndex === 1) {
      game.stalemate.p2Ready = true;
    }

    // Send updated stalemate status to all players
    const stalemateStatus = {
      p1Ready: game.stalemate.p1Ready,
      p2Ready: game.stalemate.p2Ready,
      message: game.stalemate.p1Ready || game.stalemate.p2Ready ?
        "Reshuffle requested - waiting for agreement..." : ""
    };

    players.forEach(pid => {
      sockets[pid].emit("stalemateStatus", stalemateStatus);
    });

    // Notify other player with specific message
    players.forEach(pid => {
      if (pid !== socket.id) {
        sockets[pid].emit("opponentDeclaredStalemate");
      }
    });

    handleStalemate();
  });

  // --------------------
  // DISCONNECT
  // --------------------
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    const playerIndex = players.indexOf(socket.id);
    if (playerIndex !== -1) {
      // Notify other player
      players.forEach(pid => {
        if (pid !== socket.id && sockets[pid]) {
          sockets[pid].emit("playerDisconnected");
        }
      });
    }

    players = players.filter(p => p !== socket.id);
    delete sockets[socket.id];
    delete playerNames[socket.id];

    if (players.length < 2) {
      gameActive = false;
      gameState = 'waiting';
    }
  });
});

// --------------------
// FINISH GAME
// --------------------
function endGame(winnerID) {
  gameActive = false;
  gameState = 'ended';

  const winnerIndex = players.indexOf(winnerID);
  const loserID = players.find(p => p !== winnerID);
  const loserIndex = players.indexOf(loserID);

  const winnerName = playerNames[winnerID];
  const loserName = playerNames[loserID];

  // Calculate remaining cards for loser
  let loserRemainingCards = 0;
  if (loserIndex === 0) {
    loserRemainingCards = game.p1Hand.length +
      game.p1SidePiles[0].length +
      game.p1SidePiles[1].length +
      game.p1MainDeck.length;
  } else {
    loserRemainingCards = game.p2Hand.length +
      game.p2SidePiles[0].length +
      game.p2SidePiles[1].length +
      game.p2MainDeck.length;
  }

  const gameResult = {
    winner: winnerName,
    loser: loserName,
    loserRemainingCards: loserRemainingCards,
    timestamp: new Date()
  };

  // Save to database
  saveGameResult(gameResult);

  // Notify both players
  players.forEach(pid => {
    sockets[pid].emit("gameOver", {
      winner: winnerName,
      loser: loserName,
      loserRemainingCards: loserRemainingCards,
      yourResult: pid === winnerID ? 'win' : 'loss'
    });
  });
}

// Save game result to MongoDB
async function saveGameResult(result) {
  try {
    const db = dbo.getDb();
    await db.collection("speedResults").insertOne(result);
    console.log("Game result saved:", result);

    // Send past results for winner
    const pastResults = await db.collection("speedResults")
      .find({ winner: result.winner })
      .sort({ timestamp: -1 })
      .toArray();

    // Find winner's socket and send past results
    const winnerSocket = Object.keys(playerNames).find(id => playerNames[id] === result.winner);
    if (winnerSocket && sockets[winnerSocket]) {
      sockets[winnerSocket].emit("pastResults", pastResults);
    }

  } catch (err) {
    console.error("Error saving game result:", err);
  }
}

// --------------------
// START SERVER
// --------------------
server.listen(port, () => {
  dbo.connectToServer((err) => { if (err) console.error(err); });
  console.log("Server running on port", port);
});
