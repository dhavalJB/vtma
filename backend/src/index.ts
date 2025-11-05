import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initializeTon } from "./ton/tonClient";

import sbtRoute from "./routes/sbtVoicRoute";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize TON client first
(async () => {
  try {
    await initializeTon();
    console.log("✅ TON client initialized");

    // Mount routes AFTER TON is ready
    app.use("/api", sbtRoute);

    // Start server
    app.listen(PORT, () => {
      console.log(`⚡ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to initialize TON client:", err);
    process.exit(1);
  }
})();
