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

    // enerate TrustLedger certificate + VOIC + NFT metadata
    const result = await generateVishwasPatra({
      institutionName: collegeName,
      registrationId: regId,
      verifiedBy: "Meta Realm Official",
      mockId,
    });

    console.log("\n Certificate is ready for Verification:", result);

    return res.status(200).json({
      message: "TrustLedger (SBT) generated successfully",
      data: result,
    });
  } catch (error: any) {
    console.error(" Error in /generate-sbt:", error);
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

    // --- Input Valiation ---
    if (!metaUri || !walletId || !mockID) {
      return res
        .status(400)
        .json({ error: "metaUri, walletId, and mockID are required." });
    }

    // --- Parse Wallet ---
    let ownerAddress;
    try {
      ownerAddress = Address.parse(walletId);
    } catch (e) {
      console.warn(" Invalid walletId format:", walletId);
      return res.status(400).json({ error: "Invalid walletId format." });
    }

    // --- Build TON content cell ---
    const contentCell = beginCell()
      .storeUint(0x01, 8)
      .storeStringTail(metaUri)
      .endCell();

    const config = {
      index: 0n,
      collectionAddress: null,
      ownerAddress,
      content: contentCell,
    };

    const sbtItem = SbtItem.createFromConfig(config, sbtCodeCell);
    const sbtContract = tonClient.open(sbtItem);

    // --- Deploy the SBT ---
    await sbtContract.sendDeploy(adminSender, toNano("0.05"));
    const deployedAddress = sbtContract.address.toString();

    console.log(` Deploy message sent. SBT Address: ${deployedAddress}`);

    // --- Update Firestore ---
    const collegeDocRef = db.collection("colleges").doc(mockID);
    const collegeSnap = await collegeDocRef.get();

    if (collegeSnap.exists) {
      console.log(`📘 Found existing college document for ${mockID}.`);
      await collegeDocRef.set(
        {
          sbtAddress: deployedAddress,
          deployAddress: deployedAddress,
          lastMintedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      console.log(` Stored sbtAddress (${deployedAddress}) in Firestore.`);
    } else {
      await collegeDocRef.set({
        sbtAddress: deployedAddress,
        deployAddress: deployedAddress,
        createdAt: new Date().toISOString(),
      });
      console.log(
        `🆕 Created new college doc for ${mockID} with deployAddress.`
      );
    }

    // --- Verify Firestore Write ---
    const verifySnap = await collegeDocRef.get();
    if (verifySnap.exists) {
      const verifyData = verifySnap.data();
      console.log(" Firestore document after update:", verifyData);

      if (verifyData && verifyData.deployAddress === deployedAddress) {
        console.log(" Firestore write verified successfully!");
      } else {
        console.warn(
          " Firestore write mismatch or deployAddress missing:",
          verifyData?.deployAddress
        );
      }
    } else {
      console.error(" Firestore verification failed — document not found!");
    }

    // --- Respond to frontend ---
    res.status(200).json({
      message: "SBT deployed and Firestore verified",
      sbtAddress: deployedAddress,
      ownerAddress: ownerAddress.toString(),
      firestoreStatus: "verified",
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(" Error in /mint-voic-sbt:", error.message);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message,
      });
    } else {
      console.error(" Unknown error in /mint-voic-sbt:", error);
      res.status(500).json({
        error: "Unknown Server Error",
        details: String(error),
      });
    }
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
    console.error(" SBT verification failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
