import express from "express";
import { verifyPdf } from "../verifier/verify-pdf";

const router = express.Router();

router.post("/verify-pdf", verifyPdf);

export default router;
