import express from "express";
import { verifyPdf } from "../verifier/verify-pdf";

const router = express.Router();

// 🔹 POST /verify/verify-pdf
router.post("/verify-pdf", verifyPdf);

// 🔹 POST /verify/verify-by-hash

export default router;
