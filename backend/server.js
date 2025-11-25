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

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Tell the frontend to ask for the name
  socket.emit("requestName", "Please enter your name.");

  socket.on("submitName", (name) => {
    names[socket.id] = name;

    // Assign Player 1 if empty
    if (!players.player1) {
      players.player1 = socket.id;
      console.log("Assigned Player 1:", name);
    }
    // Assign Player 2 if empty
    else if (!players.player2) {
      players.player2 = socket.id;
      console.log("Assigned Player 2:", name);
    }

    // If only Player 1 is set → waiting
    if (players.player1 && !players.player2) {
      socket.emit("waiting", "Waiting for Player 2 to join...");
      return;
    }

    // When both players are ready → start
    if (players.player1 && players.player2) {
      io.emit("startChat", {
        message: "Both players connected! Starting game...",
        players: {
          p1: names[players.player1],
          p2: names[players.player2],
        },
      });
    }
  });

  socket.on("submitWord", (word) => {
    // Only Player 1 can submit the word
    if (socket.id !== players.player1) {
      socket.emit("errorMessage", "Only Player 1 can choose the word.");
      return;
    }

    secretWord = word.toLowerCase();
    console.log("Secret word:", secretWord);

    // Send both players to the game screen
    io.emit("wordChosen", {
      message: "Word chosen! Starting game...",
    });
  });

  socket.on("whoAmI", () => {
    if (socket.id === players.player1) {
      socket.emit("youAre", { player: 1 });
    } else if (socket.id === players.player2) {
      socket.emit("youAre", { player: 2 });
    }
  });

  socket.on("chatMessage", (text) => {
    io.emit("chatMessage", {
      sender: names[socket.id],
      text,
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Reset everything if a player leaves
    if (players.player1 === socket.id || players.player2 === socket.id) {
      players = { player1: null, player2: null };
      names = {};
      io.emit("reset", "A player disconnected. Restarting game...");
    }
  });
});

// Start server and connect to MongoDB
server.listen(port, () => {
  dbo.connectToServer((err) => {
    if (err) console.error(err);
  });
  console.log(`Server is running on port ${port}`);
});
