// src/routes/sbtRoute.ts
import express from "express";
import { generateVishwasPatra } from "../generator/generateCertificate"; // adjust path if needed
import { SbtItem } from "../ton/SbtItem"; // Adjust path as needed
import { tonClient, sbtCodeCell, adminSender } from "../ton/tonClient";
import { Address, beginCell, toNano } from "ton";
import { verifySBTonTON } from "../utils/verifySBTonTon";

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
    const { metaUri, walletId } = req.body;

    console.log("\n🟢 Received SBT Minting Request:");
    console.log("Meta URI:", metaUri);
    console.log("Wallet ID:", walletId);

    // --- DEPLOYMENT LOGIC STARTS HERE ---

    // 1. Validate inputs
    if (!metaUri || !walletId) {
      return res
        .status(400)
        .json({ error: "metaUri and walletId are required." });
    }

    // 2. Parse the USER'S wallet address (this is the new owner)
    let ownerAddress: Address;
    try {
      ownerAddress = Address.parse(walletId);
    } catch (e) {
      console.warn("Invalid walletId format:", walletId);
      return res.status(400).json({ error: "Invalid walletId format." });
    }

    // 3. Create the content cell for the metadata
    const contentCell = beginCell()
      .storeUint(0x01, 8) // TEP-64 'off-chain' prefix
      .storeStringTail(metaUri)
      .endCell();

    // 4. Create the contract configuration
    const config = {
      index: 0n, // Standalone SBT
      collectionAddress: null, // Standalone SBT
      ownerAddress: ownerAddress, // <-- The USER'S wallet
      content: contentCell,
    };

    // 5. Create contract instance from our PRE-COMPILED code
    const sbtItem = SbtItem.createFromConfig(config, sbtCodeCell);

    // 6. Open the contract with our shared tonClient
    const sbtContract = tonClient.open(sbtItem);

    // 7. Send the deploy transaction
    // The gas fee (0.05 TON) is paid by our ADMIN_SENDER
    await sbtContract.sendDeploy(adminSender, toNano("0.05"));

    // 8. Respond immediately to the user
    // We don't wait for the deployment to finish, as it can take time.
    const deployedAddress = sbtContract.address.toString();
    console.log(`✅ Deploy message sent. SBT Address: ${deployedAddress}`);

    res.status(200).json({
      message: "SBT deployment message sent.",
      sbtAddress: deployedAddress,
      ownerAddress: ownerAddress.toString(),
    });

    // --- DEPLOYMENT LOGIC ENDS HERE ---
  } catch (error: any) {
    console.error("❌ Error in /mint-sbt:", error.message);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

router.get("/verify-sbt", async (req, res) => {
  try {
    const wallet = req.query.wallet as string | undefined;
    const college = req.query.college as string | undefined;
    const deployAddress = req.query.deployAddress as string | undefined;

    if (!wallet || !college || !deployAddress) {
      return res.status(400).json({ error: "Missing wallet, college, or deployAddress" });
    }

    const hasSBT = await verifySBTonTON(wallet, college, deployAddress);
    res.json({ hasSBT });
  } catch (err) {
    console.error("❌ SBT verification failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
