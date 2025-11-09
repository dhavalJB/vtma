import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initializeTon } from "./ton/tonClient";

import sbtRoute from "./routes/sbtVoicRoute";
import templatesRoute from "./routes/templateRoute";
import logoUploadRoute from "./routes/mintLogoRoute";
import studentsRoute from "./routes/studentsRoute";
import verificationRoute from "./routes/verificationRoute";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Mount routes (Standard Express Practice) ---
// Routes are mounted synchronously before any async logic or server start.
app.use("/api", sbtRoute);
app.use("/template", templatesRoute);
app.use("/api", logoUploadRoute);
app.use("/api", studentsRoute);
app.use("/verify", verificationRoute);

// --- Initialize TON client first, then start server ---
(async () => {
  try {
    await initializeTon();
    console.log("✅ TON client initialized"); // --- Start server AFTER TON is ready ---

    app.listen(PORT, () => {
      console.log(`⚡ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to initialize TON client:", err);
    process.exit(1);
  }
})();
