const express = require("express");
const router = express.Router();
const dbo = require("../db/conn");

router.post("/speed/save", async (req, res) => {
  try {
    const db = dbo.getDb();
    await db.collection("speedScores").insertOne(req.body);
    res.json({ message: "Score saved" });
  } catch (err) {
    res.status(500).json({ error: "DB insert failed" });
  }
});

router.get("/speed/history/:name", async (req, res) => {
  try {
    const db = dbo.getDb();
    const docs = await db.collection("speedScores")
      .find({ name: req.params.name })
      .sort({ timestamp: -1 })
      .toArray();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "DB fetch failed" });
  }
});

module.exports = router;
