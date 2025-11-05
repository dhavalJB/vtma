// src/index.ts
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

import { db } from "./config/firebaseConfig";

import sbtRoute from "./routes/sbtVoicRoute";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api", sbtRoute);

// Start server
app.listen(PORT, () => {
  console.log(`⚡ Server running on port ${PORT}`);
});
