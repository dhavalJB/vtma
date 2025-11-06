// src/routes/sbtRoute.ts
import express from "express";
import { generateVishwasPatra } from "../generator/generateCertificate"; // adjust path if needed
import { SbtItem } from "../ton/SbtItem"; // Adjust path as needed
import { tonClient, sbtCodeCell, adminSender } from "../ton/tonClient";
import { Address, beginCell, toNano } from "ton";
import { verifySBTonTON } from "../utils/verifySBTonTon";
import { db } from "../config/firebaseConfig";
const router = express.Router();

router.post("/generate-voic-sbt", async (req, res) => {
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

    console.log("\n✅ Certificate is ready for Verification:", result);

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

router.post("/mint-voic-sbt", async (req, res) => {
  try {
    const { metaUri, walletId, mockID } = req.body;

    console.log("\n🟢 Received SBT Minting Request:");
    console.log("Meta URI:", metaUri);
    console.log("Wallet ID:", walletId);
    console.log("Mock ID:", mockID);

    // --- Input Validation ---
    if (!metaUri || !walletId || !mockID) {
      return res
        .status(400)
        .json({ error: "metaUri, walletId, and mockID are required." });
    }

    // --- Parse USER'S wallet address ---
    let ownerAddress: Address;
    try {
      ownerAddress = Address.parse(walletId);
    } catch (e) {
      console.warn("Invalid walletId format:", walletId);
      return res.status(400).json({ error: "Invalid walletId format." });
    }

    // --- Create the content cell for metadata ---
    const contentCell = beginCell()
      .storeUint(0x01, 8)
      .storeStringTail(metaUri)
      .endCell();

    // --- Create contract config & instance ---
    const config = {
      index: 0n,
      collectionAddress: null,
      ownerAddress,
      content: contentCell,
    };
    const sbtItem = SbtItem.createFromConfig(config, sbtCodeCell);
    const sbtContract = tonClient.open(sbtItem);

    // --- Send deploy transaction ---
    await sbtContract.sendDeploy(adminSender, toNano("0.05"));
    const deployedAddress = sbtContract.address.toString();
    console.log(`✅ Deploy message sent. SBT Address: ${deployedAddress}`);

    // --- Store deployAddress in Firestore (Admin SDK) ---
    const collegeDocRef = db.collection("colleges").doc(mockID);
    const collegeSnap = await collegeDocRef.get();

    if (collegeSnap.exists) {
      const data = collegeSnap.data();
      if (!data?.sbtAddress) {
        await collegeDocRef.set(
          { sbtAddress: deployedAddress },
          { merge: true }
        );
        console.log(`✅ Stored deployAddress for mockID ${mockID}`);
      } else {
        console.log(`⚠️ sbtAddress already exists, skipping Firestore update.`);
      }
    } else {
      await collegeDocRef.set({ sbtAddress: deployedAddress });
      console.log(
        `✅ Created college doc and stored deployAddress for mockID ${mockID}`
      );
    }

    // --- Respond to frontend ---
    res.status(200).json({
      message: "SBT deployed and Firestore updated",
      sbtAddress: deployedAddress,
      ownerAddress: ownerAddress.toString(),
    });
  } catch (error: any) {
    console.error("❌ Error in /mint-voic-sbt:", error.message);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

router.get("/verify-sbt", async (req, res) => {
  try {
    const wallet = req.query.wallet as string | undefined;
    const college = req.query.college as string | undefined;
    const deployAddress = req.query.deployAddress as string | undefined;

    if (!wallet || !college || !deployAddress) {
      return res
        .status(400)
        .json({ error: "Missing wallet, college, or deployAddress" });
    }

    const hasSBT = await verifySBTonTON(wallet, college, deployAddress);
    res.json({ hasSBT });
  } catch (err) {
    console.error("❌ SBT verification failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
