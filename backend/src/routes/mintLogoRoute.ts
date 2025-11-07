// routes/mintLogoSbt.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../config/firebaseConfig";
import { uploadBufferToPinata } from "../config/pinataConfig";
import { SbtItem } from "../ton/SbtItem";
import { tonClient, sbtCodeCell, adminSender } from "../ton/tonClient";
import { Address, beginCell, toNano } from "ton";

const router = express.Router();

// --- Multer config ---
const storage = multer.diskStorage({
destination: (req, file, cb) => cb(null, "uploads/"),
filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// --- Route ---
router.post("/mint-logo-sbt", upload.single("logo"), async (req, res) => {
try {
const { mockID, walletId, regId, fullName, shortName } = req.body;
const file = req.file;


if (!file || !mockID || !walletId || !regId || !fullName || !shortName) {
  return res.status(400).json({ error: "Missing required fields" });
}

// --- Rename file and read buffer ---
const ext = path.extname(file.originalname);
const newFileName = `${regId}_logo${ext}`;
const newPath = path.join("uploads", newFileName);
fs.renameSync(file.path, newPath);
const buffer = fs.readFileSync(newPath);

// --- Upload logo to Pinata ---
const pinataUpload = await uploadBufferToPinata(buffer, newFileName);

// --- Generate metadata JSON ---
const now = new Date().toISOString();
const metadata = {
  name: `Institution Logo - ${regId} - ${shortName}`,
  description: `Official institutional logo of ${fullName} (${shortName}), used for certificate generation and on-chain verification.`,
  image: `ipfs://${pinataUpload.cid}`,
  normalImage: pinataUpload.url,
  attributes: [
    { trait_type: "Institution (Short)", value: shortName },
    { trait_type: "Institution (Full)", value: fullName },
    { trait_type: "Registration ID", value: regId },
    { trait_type: "Network", value: "TON Testnet" },
    { trait_type: "Type", value: "Institution Logo" },
  ],
  uploadedAt: now,
};

// --- Upload metadata JSON to Pinata ---
const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
const metadataUpload = await uploadBufferToPinata(metadataBuffer, `${regId}_logo_meta.json`);
const metaUri = `ipfs://${metadataUpload.cid}`;

// --- Mint SBT using metadata URI ---
let ownerAddress: Address;
try {
  ownerAddress = Address.parse(walletId);
} catch {
  return res.status(400).json({ error: "Invalid walletId format." });
}

const contentCell = beginCell().storeUint(0x01, 8).storeStringTail(metaUri).endCell();
const sbtConfig = { index: 0n, collectionAddress: null, ownerAddress, content: contentCell };
const sbtItem = SbtItem.createFromConfig(sbtConfig, sbtCodeCell);
const sbtContract = tonClient.open(sbtItem);

await sbtContract.sendDeploy(adminSender, toNano("0.05"));
const deployedAddress = sbtContract.address.toString();

// --- Update Firestore ---
const collegeRef = db.collection("colleges").doc(mockID);
const collegeSnap = await collegeRef.get();

let logoArray: any[] = [];
const existingLogo = collegeSnap.data()?.logo;
if (existingLogo) {
  if (Array.isArray(existingLogo)) logoArray = existingLogo;
  else if (typeof existingLogo === "object") logoArray = [existingLogo];
}

logoArray.push({
  ...metadata,
  ipfs: metaUri,
  normalUrl: metadataUpload.url,
  contractAddress: deployedAddress,
});

await collegeRef.set({ logo: logoArray }, { merge: true });

// --- Respond ---
res.status(200).json({
  message: "Logo uploaded, metadata stored, and SBT minted successfully",
  logoMeta: metadata,
  ipfs: metaUri,
  normalUrl: metadataUpload.url,
  contractAddress: deployedAddress,
});


} catch (err: any) {
console.error("❌ Error in /mint-logo-sbt:", err.message);
res.status(500).json({ error: "Server error", details: err.message });
}
});

export default router;
