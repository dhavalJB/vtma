// src/routes/sbtRoute.ts
import express from "express";
import { generateVishwasPatra } from "../generator/generateCertificate"; // adjust path if needed

const router = express.Router();

router.post("/generate-sbt", async (req, res) => {
  try {
    const { collegeName, regId, walletId, mockId } = req.body;

    console.log("\n🟢 Received SBT Generation Request:");
    console.log("College Name:", collegeName);
    console.log("Registration ID:", regId);
    console.log("Wallet ID:", walletId);
    console.log("Mock ID:", mockId);

    if (!collegeName || !regId || !walletId || !mockId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🧩 Generate VishwasPatra certificate + VOIC + NFT metadata
    const result = await generateVishwasPatra({
      institutionName: collegeName,
      registrationId: regId,
      verifiedBy: "Meta Realm Official",
      mockId,
    });

    console.log("\n✅ SBT generation complete:", result);

    return res.status(200).json({
      message: "VishwasPatra (SBT) generated successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("❌ Error in /generate-sbt:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

export default router;
