import fs from "fs"; // Still need this for readFile
import path from "path";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import { PinataSDK } from "pinata";
import dotenv from "dotenv";
import { db } from "../config/firebaseConfig";
import { File } from "buffer";

dotenv.config();

// ========================== ⚙️ Pinata Setup ==========================
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

// ========================== 🧩 Helpers ==========================
function normalizeGateway(gateway?: string) {
  return (gateway ?? "https://gateway.pinata.cloud").replace(
    /^https?:\/\//,
    ""
  );
}

export async function uploadBufferToPinata(buffer: Buffer, fileName: string) {
  // 1. Determine MIME type
  const mimeType = fileName.endsWith(".json")
    ? "application/json"
    : "image/png";

  const file = new File([buffer], fileName, { type: mimeType });
  const upload = await pinata.upload.public.file(file as any);

  // 4. Construct the gateway URL
  const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
  const url = `https://${normalizeGateway(gateway)}/ipfs/${upload.cid}`;
  console.log(`📤 Uploaded → ${url}`);

  return { url, cid: upload.cid };
}

// ========================== 🏫 Certificate Generator ==========================
export async function generateCertificate({
  institutionName,
  registrationId,
  verifiedBy,
}: {
  institutionName: string;
  registrationId: string;
  verifiedBy: string;
}) {
  const certTemplatePath = path.resolve("./src/templates/certificate.html");
  let html = await fs.promises.readFile(certTemplatePath, "utf8"); // Use fs.promises

  html = html
    .replace(/{{INSTITUTION_NAME}}/g, institutionName)
    .replace(/{{REGISTRATION_ID}}/g, registrationId)
    .replace(/{{VERIFIED_BY}}/g, verifiedBy)
    .replace(/{{YEAR}}/g, new Date().getFullYear().toString());

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMediaType("screen");
  await page.setViewport({ width: 1056, height: 816, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });

  const buffer = Buffer.from(
    (await page.screenshot({ encoding: "binary" })) as Buffer
  );
  await browser.close();

  const upload = await uploadBufferToPinata(
    buffer,
    `${institutionName}_certificate.png`
  );
  return { certURL: upload.url, certCID: upload.cid };
}

// ========================== 🎫 VOIC Card Generator ==========================
async function generateVOIC({
  college,
  certificateURL,
}: {
  college: string;
  certificateURL: string;
}) {
  const qrCode = await QRCode.toDataURL(certificateURL);
  const voicTemplatePath = path.resolve("./src/templates/voic.html");
  let html = await fs.promises.readFile(voicTemplatePath, "utf8"); // Use fs.promises

  html = html
    .replace(/{{COLLEGE_NAME}}/g, college)
    .replace(/{{CERTIFICATE_URL}}/g, certificateURL)
    .replace(/{{QRCODE}}/g, qrCode);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMediaType("screen");
  await page.setViewport({ width: 700, height: 700, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });

  const buffer = Buffer.from(
    (await page.screenshot({ encoding: "binary" })) as Buffer
  );
  await browser.close();

  const upload = await uploadBufferToPinata(buffer, `${college}_voic.png`);
  return { voicURL: upload.url, voicCID: upload.cid, qrCode };
}

// ========================== 🚀 MAIN FLOW ==========================
export async function generateVishwasPatra({
  institutionName,
  registrationId,
  verifiedBy,
  mockId,
}: {
  institutionName: string;
  registrationId: string;
  verifiedBy: string;
  mockId: string;
}) {
  // 1️⃣ Generate both assets
  const { certURL, certCID } = await generateCertificate({
    institutionName,
    registrationId,
    verifiedBy,
  });

  const { voicURL, voicCID } = await generateVOIC({
    college: institutionName,
    certificateURL: certURL,
  });

  // 2️⃣ Prepare NFT metadata
  const nftMetadata = {
    name: `VishwasPatra – ${institutionName}`,
    description: `Officially verified VishwasPatra certificate issued to ${institutionName} by ${verifiedBy}.`,
    image: `ipfs://${voicCID}`,
    external_url: `https://${normalizeGateway(
      pinata.config?.pinataGateway
    )}/ipfs/${voicCID}`,
    attributes: [
      { trait_type: "Institution Name", value: institutionName },
      { trait_type: "Registration ID", value: registrationId },
      { trait_type: "Verified By", value: verifiedBy },
      { trait_type: "Issued At", value: new Date().toISOString() },
      { trait_type: "Certificate IPFS", value: `ipfs://${certCID}` },
    ],
    properties: {
      certificate: { ipfs: `ipfs://${certCID}`, url: certURL },
      voic: { ipfs: `ipfs://${voicCID}`, url: voicURL },
      metadata_creator: "VishwasPatra DApp",
      network: "TON Testnet",
    },
  };

  const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata, null, 2));
  const metadataUpload = await uploadBufferToPinata(
    metadataBuffer,
    `${institutionName}_metadata.json`
  );

  // 3️⃣ Store to Firestore
  const docData = {
    institutionName,
    registrationId,
    verifiedBy,
    metadata: `ipfs://${metadataUpload.cid}`,
    certificate: `ipfs://${certCID}`,
    voic: `ipfs://${voicCID}`, // <-- FIXED TYPO
    metadata_json: nftMetadata,
    issuedAt: new Date().toISOString(),
    network: "TON Testnet",
  };

  await Promise.all([
    db
      .collection("colleges")
      .doc(mockId)
      .collection("nftMetaData")
      .doc("latest")
      .set(docData),
    db
      .collection("collegeRegistrar")
      .doc(registrationId)
      .collection("nftMetaData")
      .doc("latest")
      .set(docData),
  ]);

  console.log("\n✅ VishwasPatra NFT Created Successfully");
  console.log("📦 Metadata:", `ipfs://${metadataUpload.cid}`);
  console.log("📜 Certificate:", certURL);
  console.log("🪪 VOIC:", voicURL);

  return {
    metadata: `ipfs://${metadataUpload.cid}`,
    certificate: `ipfs://${certCID}`,
    voic: `ipfs://${voicCID}`,
  };
}
