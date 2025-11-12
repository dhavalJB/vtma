import { Router } from "express";
// import puppeteer from "puppeteer"; // <-- This should be gone or commented out
import { db } from "../config/firebaseConfig";
import { uploadBufferToPinata } from "../config/pinataConfig";
import { SbtItem } from "../ton/SbtItem";
import { tonClient, sbtCodeCell, adminSender } from "../ton/tonClient";
import { Address, beginCell, toNano } from "ton";
import { admin } from "../config/firebaseConfig";

const router = Router();

// --- Internal function to mint college SBT ---
const mintForCollege = async (collegeWallet: string, metaUri: string) => {
  console.log("⛓ Minting SBT for college wallet:", collegeWallet);
  const ownerAddress = Address.parse(collegeWallet);
  const index = BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000));
  const contentCell = beginCell()
    .storeUint(0x01, 8)
    .storeStringTail(metaUri)
    .endCell();
  const sbtItem = SbtItem.createFromConfig(
    { index, collectionAddress: null, ownerAddress, content: contentCell },
    sbtCodeCell
  );
  const sbtContract = tonClient.open(sbtItem);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sbtContract.sendDeploy(adminSender, toNano("0.05"));
      console.log(
        "✅ College wallet minted at:",
        sbtContract.address.toString()
      );
      return sbtContract.address.toString();
    } catch (err: any) {
      console.warn(
        `⚠ Attempt ${attempt} failed for college wallet:`,
        err.message
      );
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error("Failed to mint college SBT after 3 attempts");
};

// --- Student mint route ---
router.post("/student-gen-mint", async (req, res) => {
  const startTime = new Date();
  console.log("🚀 Mint process started at", startTime.toISOString());

  try {
    const {
      html,
      studentId,
      templateId,
      studentWallet,
      collegeWallet,
      collegeId,
      collegeDetails,
    } = req.body;

    if (
      !html ||
      !studentId ||
      !templateId ||
      !studentWallet ||
      !collegeWallet
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- UPDATED BROWSERLESS LOGIC (SEQUENTIAL) ---
    console.log("🖨 Generating PDF and PNG via REST API...");

    const API_KEY = process.env.BROWSERLESS_API_KEY;
    if (!API_KEY) throw new Error("BROWSERLESS_API_KEY is not set");

    // --- 1. Get PDF first ---
    console.log("Requesting PDF...");
    const pdfResponse = await fetch(
      `https://production-sfo.browserless.io/pdf?token=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: html, // CORRECTED: These properties must be inside an "options" object
          options: {
            format: "A4",
            printBackground: true,
          },
        }),
      }
    );

    if (!pdfResponse.ok) {
      throw new Error(
        `Browserless PDF failed: ${
          pdfResponse.status
        } ${await pdfResponse.text()}`
      );
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log("✅ PDF received.");

    // --- 2. Get PNG second ---
    console.log("Requesting PNG...");
    const pngResponse = await fetch(
      `https://production-sfo.browserless.io/screenshot?token=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: html,
          options: {
            type: "png",
            encoding: "binary",
            fullPage: true, // Added this from your previous logic
          },
          // viewport is optional if fullPage is true, but we can keep it
          viewport: {
            width: 1056,
            height: 816,
            deviceScaleFactor: 2,
          },
        }),
      }
    );

    if (!pngResponse.ok) {
      throw new Error(
        `Browserless PNG failed: ${
          pngResponse.status
        } ${await pngResponse.text()}`
      );
    }
    const pngBuffer = await pngResponse.arrayBuffer();
    console.log("✅ PNG received.");

    console.log("✅ PDF & PNG generated");
    // --- END OF UPDATE ---

    // --- Upload to Pinata ---
    const fileBaseName = `${studentId}-${templateId}`;
    console.log("📤 Uploading PDF...");
    const pdfUpload = await uploadBufferToPinata(
      Buffer.from(pdfBuffer), // Convert ArrayBuffer to Buffer
      `${fileBaseName}.pdf`
    );
    console.log("✅ PDF uploaded:", pdfUpload.url);

    console.log("📤 Uploading PNG...");
    const pngUpload = await uploadBufferToPinata(
      Buffer.from(pngBuffer), // Convert ArrayBuffer to Buffer
      `${fileBaseName}.png`
    );
    console.log("✅ PNG uploaded:", pngUpload.url);

    // --- Metadata ---
    console.log("📝 Creating NFT metadata...");
    const now = new Date().toISOString();
    const metadata = {
      name: `Certificate - ${studentId}`,
      description: `Degree/Certificate for student ${studentId} from ${collegeDetails.fullName}`,
      image: `ipfs://${pngUpload.cid}`,
      pdf: `ipfs://${pdfUpload.cid}`,
      publicImageUrl: pngUpload.url,
      publicPdfUrl: pdfUpload.url,
      studentId,
      collegeId,
      templateId,
      collegeDetails,
      uploadedAt: now,
      attributes: [
        { trait_type: "College Short Name", value: collegeDetails.shortName },
        { trait_type: "College Full Name", value: collegeDetails.fullName },
        { trait_type: "Student Wallet", value: studentWallet },
        { trait_type: "Template ID", value: templateId },
      ],
    };
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    console.log("📤 Uploading metadata JSON...");
    const metadataUpload = await uploadBufferToPinata(
      metadataBuffer,
      `${fileBaseName}_metadata.json`
    );
    const metaUri = `ipfs://${metadataUpload.cid}`;
    console.log("✅ Metadata uploaded:", metaUri); // Changed log to show metaUri

    // --- Mint helper for student ---
    const mintSBT = async (wallet: string, role: string, amountTON: string) => {
      console.log(`⛓ Minting SBT to ${role} wallet: ${wallet}`);
      const ownerAddress = Address.parse(wallet);
      const index =
        BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000));
      const contentCell = beginCell()
        .storeUint(0x01, 8)
        .storeStringTail(metaUri)
        .endCell();
      const sbtItem = SbtItem.createFromConfig(
        { index, collectionAddress: null, ownerAddress, content: contentCell },
        sbtCodeCell
      );
      const sbtContract = tonClient.open(sbtItem);

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sbtContract.sendDeploy(adminSender, toNano(amountTON));
          console.log(
            `✅ ${role} wallet minted at:`,
            sbtContract.address.toString()
          );
          return sbtContract.address.toString();
        } catch (err: any) {
          console.warn(
            `⚠ Attempt ${attempt} failed for ${role} wallet:`,
            err.message
          );
          if (attempt === 3) throw err;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      throw new Error(`Failed to mint ${role} wallet after 3 attempts`);
    };

    // --- Mint Student first ---
    const studentContractAddress = await mintSBT(
      studentWallet,
      "student",
      "0.05"
    );

    // --- Wait 15 seconds before calling college mint ---
    console.log("⏳ Waiting 15 seconds before minting for college...");
    await new Promise((r) => setTimeout(r, 15000));

    const collegeContractAddress = await mintForCollege(collegeWallet, metaUri);

    // --- Store in Firestore ---
    console.log("💾 Saving certificate info to Firestore...");
    const studentRef = db
      .collection("colleges")
      .doc(collegeId)
      .collection("students")
      .doc(studentId)
      .collection("certificates")
      .doc(templateId);
    await studentRef.set(
      {
        studentId,
        templateId,
        metaUri,
        pdfIpfs: `ipfs://${pdfUpload.cid}`,
        pngIpfs: `ipfs://${pngUpload.cid}`,
        pdfUrl: pdfUpload.url,
        pngUrl: pngUpload.url,
        studentContractAddress,
        collegeContractAddress,
        collegeDetails,
        mintedAt: now,
        metadata,
      },
      { merge: true }
    );

    try {
      const collegeRef = db.collection("colleges").doc(collegeId);
      await collegeRef.update({
        certificateIssued: admin.firestore.FieldValue.increment(1),
      });
      console.log("📈 certificateIssued incremented successfully.");
    } catch (incrementErr) {
      if (incrementErr instanceof Error) {
        console.warn(
          "⚠️ Failed to increment certificateIssued:",

          incrementErr.message
        );
      } else {
        console.warn("⚠️ Failed to increment certificateIssued:", incrementErr);
      }
    }

    console.log("✅ Certificate process completed successfully!");
    res.status(200).json({
      message: "Certificate minted successfully",
      metaUri,
      pdfIpfs: `ipfs://${pdfUpload.cid}`,
      pngIpfs: `ipfs://${pngUpload.cid}`,
      studentContractAddress,
      collegeContractAddress,
    });
  } catch (err: any) {
    console.error("❌ Error in /student-gen-mint:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;
