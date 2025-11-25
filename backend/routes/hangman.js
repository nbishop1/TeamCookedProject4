const express = require("express");

// router is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /record.
const router = express.Router();

// This will help us connect to the database
const dbo = require("../db/conn");

// This helps convert the id from string to ObjectId for the _id.
const ObjectId = require("mongodb").ObjectId;

// Middleware: require session
function requireSession(req, res, next) {
  if (!req.session.userId) {
    return res.status(400).json({ error: "session not set yet" });
  }
  next();
}

router.get("/hangman/scores", async (req, res) => {
  try {
    // Create session if it doesn't exist
    if (!req.session.userId) {
      req.session.userId = "temp-" + Date.now();
    }

    const db_connect = dbo.getDb();
    const scores = await db_connect.collection("hangmanScores").find({}).toArray();
    res.json(scores);
  } catch (error) {
    console.error("Error fetching scores:", error);
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

// Initialize words collection with sample words (no session required for setup)
router.post("/hangman/init-words", async (req, res) => {
  try {
    const db_connect = dbo.getDb();

    // Check if words already exist
    const existingWords = await db_connect.collection("words").countDocuments();
    if (existingWords > 0) {
      return res.json({ message: "Words already initialized", count: existingWords });
    }

    const sampleWords = [
      { word: "javascript" },
      { word: "python" },
      { word: "computer" },
      { word: "programming" },
      { word: "hangman" },
      { word: "database" },
      { word: "algorithm" },
      { word: "function" },
      { word: "variable" },
      { word: "keyboard" },
      { word: "monitor" },
      { word: "internet" },
      { word: "software" },
      { word: "hardware" },
      { word: "technology" },
      { word: "application" },
      { word: "development" },
      { word: "framework" },
      { word: "library" },
      { word: "server" },
      { word: "client" },
      { word: "network" },
      { word: "security" },
      { word: "encryption" },
      { word: "password" }
    ];

    const result = await db_connect.collection("words").insertMany(sampleWords);
    res.json({
      message: "Words initialized successfully",
      count: result.insertedCount
    });
  } catch (error) {
    console.error("Error initializing words:", error);
    res.status(500).json({ error: "Failed to initialize words" });
  }
});

module.exports = router;