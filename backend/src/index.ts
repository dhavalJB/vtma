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

// --- Mount routes ---
app.get("/", (req, res) => res.send("⚔️ VP backend is alive 🚀"));

app.use("/api", sbtRoute);
app.use("/template", templatesRoute);
app.use("/api", logoUploadRoute);
app.use("/api", studentsRoute);
app.use("/verify", verificationRoute);

// --- Initialize TON client first, then start server ---
(async () => {
  try {
    await initializeTon();
    console.log("✅ TON client initialized");

    app.listen(PORT, () => {
      console.log(`⚡ Server running on port ${PORT}`);

      // --- Keep-alive Ping Every 40 Seconds ---
      const PING_URL = "https://vtma.onrender.com";
      setInterval(async () => {
        try {
          const res = await fetch(PING_URL);
          console.log(`📡 Pinged ${PING_URL} — status: ${res.status}`);
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error("⚠️ Ping failed:", err.message);
          } else {
            console.error("⚠️ Ping failed:", err);
          }
        }
      }, 40000);
    });
  } catch (err) {
    console.error("❌ Failed to initialize TON client:", err);
    process.exit(1);
  }
})();
