const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

// Create Express app
const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Middleware
app.use(bodyParser.json());

// Connect to local MongoDB
mongoose
  .connect("mongodb://localhost:27017/lizardClick")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Define schema/model for a singleton click counter
const clickSchema = new mongoose.Schema({
  _id: { type: String, default: "global" },
  count: { type: Number, default: 0 },
});
const Click = mongoose.model("Click", clickSchema);

// In-memory batch counter and persisted total
let batchCount = 0; // increments in memory, resets to 0 after persisting 10
let persistedCount = 0; // mirrors DB stored total
let flushInProgress = false; // guard to avoid double-flush at boundary

// Initialize counts from DB
async function initializeClickCount() {
  try {
    let doc = await Click.findById("global");
    if (!doc) {
      doc = await Click.create({ _id: "global", count: 0 });
    }
    persistedCount = doc.count || 0;
    batchCount = 0;
    console.log("Initialized counts:", { persistedCount, batchCount });
  } catch (err) {
    console.error("Failed to initialize click count from DB:", err);
  }
}

// GET total clicks (from memory)
app.get("/clicks", (req, res) => {
  res.json({ totalClicks: persistedCount + batchCount });
});

// POST new click (increment memory, persist every 10 to MongoDB)
app.post("/click", async (req, res) => {
  batchCount += 1;
  // If batch reached 10, atomically add 10 to DB, reset batch to 0
  if (batchCount % 1000 === 0 && !flushInProgress) {
    flushInProgress = true;
    try {
      await Click.updateOne(
        { _id: "global" },
        { $inc: { count: 1000 } },
        { upsert: true }
      );
      persistedCount += 1000;
      batchCount = 0;
    } catch (err) {
      console.error("Failed to persist batch to DB:", err);
      // Keep batchCount as-is so we can retry on subsequent clicks
    } finally {
      flushInProgress = false;
    }
  }
  res.status(200).json({ totalClicks: persistedCount + batchCount });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  initializeClickCount();
});
