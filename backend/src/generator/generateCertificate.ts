import fs from "fs"; // Still need this for readFile
import path from "path";
import QRCode from "qrcode";
import { PinataSDK } from "pinata";
import dotenv from "dotenv";
import { db } from "../config/firebaseConfig";
import { File } from "buffer";

dotenv.config();

// ========================== Pinata Setup ==========================
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

// ========================== Helpers ==========================
function normalizeGateway(gateway?: string) {
  return (gateway ?? "https://gateway.pinata.cloud").replace(
    /^https?:\/\//,
    ""
  );
}

export async function uploadBufferToPinata(buffer: Buffer, fileName: string) {
  const mimeType = fileName.endsWith(".json")
    ? "application/json"
    : "image/png";

  const file = new File([buffer], fileName, { type: mimeType });
  const upload = await pinata.upload.public.file(file as any);

  const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
  const url = `https://${normalizeGateway(gateway)}/ipfs/${upload.cid}`;
  console.log(`📤 Uploaded → ${url}`);

  return { url, cid: upload.cid };
}

// ========================== Certificate Generator ==========================
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
  let html = await fs.promises.readFile(certTemplatePath, "utf8");

  html = html
    .replace(/{{INSTITUTION_NAME}}/g, institutionName)
    .replace(/{{REGISTRATION_ID}}/g, registrationId)
    .replace(/{{VERIFIED_BY}}/g, verifiedBy)
    .replace(/{{YEAR}}/g, new Date().getFullYear().toString());

  const API_KEY = process.env.BROWSERLESS_API_KEY;
  if (!API_KEY) throw new Error("BROWSERLESS_API_KEY is not set");

  const response = await fetch(
    `https://production-sfo.browserless.io/screenshot?token=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: html,
        options: {
          type: "png",
          encoding: "binary",
        },
        viewport: {
          width: 1056,
          height: 816,
          deviceScaleFactor: 2,
        },
      }),
    }
  );

  if (!response.ok) {
    // Better error logging
    const errorText = await response.text();
    throw new Error(
      `Browserless /screenshot failed: ${response.status} ${errorText}`
    );
  }
  const buffer = await response.arrayBuffer();
  const upload = await uploadBufferToPinata(
    Buffer.from(buffer), // Converting ArrayBuffer to Buffer
    `${registrationId}_certificate.png`
  );
  return { certURL: upload.url, certCID: upload.cid };
}

// ========================== VOIC Card Generator ==========================
async function generateVOIC({
  college,
  certificateURL,
  registrationId,
}: {
  college: string;
  certificateURL: string;
  registrationId: string;
}) {
  const qrCode = await QRCode.toDataURL(certificateURL);
  const voicTemplatePath = path.resolve("./src/templates/voic.html");
  let html = await fs.promises.readFile(voicTemplatePath, "utf8");

  html = html
    .replace(/{{COLLEGE_NAME}}/g, college)
    .replace(/{{CERTIFICATE_URL}}/g, certificateURL)
    .replace(/{{QRCODE}}/g, qrCode);

  const API_KEY = process.env.BROWSERLESS_API_KEY;
  if (!API_KEY) throw new Error("BROWSERLESS_API_KEY is not set");

  const response = await fetch(
    `https://production-sfo.browserless.io/screenshot?token=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: html,
        options: {
          type: "png",
          encoding: "binary",
        },
        viewport: {
          width: 700,
          height: 700,
          deviceScaleFactor: 2,
        },
      }),
    }
  );

  if (!response.ok) {
    // Better error logging
    const errorText = await response.text();
    throw new Error(
      `Browserless /screenshot failed: ${response.status} ${errorText}`
    );
  }
  const buffer = await response.arrayBuffer();
  const upload = await uploadBufferToPinata(
    Buffer.from(buffer),
    `${registrationId}_voic.png`
  );
  return { voicURL: upload.url, voicCID: upload.cid, qrCode };
}

// ========================== MAIN FLOW ==========================
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
  const { certURL, certCID } = await generateCertificate({
    institutionName,
    registrationId,
    verifiedBy,
  });

  const { voicURL, voicCID } = await generateVOIC({
    college: institutionName,
    certificateURL: certURL,
    registrationId,
  });

  const nftMetadata = {
    name: `TrustLedger – ${institutionName}`,
    description: `Officially verified TrustLedger certificate issued to ${institutionName} by ${verifiedBy}.`,
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
      metadata_creator: "TrustLedger MiniApp",
      network: "TON Testnet",
    },
  };

  const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata, null, 2));
  const metadataUpload = await uploadBufferToPinata(
    metadataBuffer,
    `${registrationId}_metadata.json`
  );

  const docData = {
    institutionName,
    registrationId,
    verifiedBy,
    metadata: `ipfs://${metadataUpload.cid}`,
    certificate: `ipfs://${certCID}`,
    voic: `ipfs://${voicCID}`,
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

  console.log("\n TrustLedger NFT Created Successfully");
  console.log("📦 Metadata:", `ipfs://${metadataUpload.cid}`);
  console.log("📜 Certificate:", certURL);
  console.log("🪪 VOIC:", voicURL);

  return {
    metadata: `ipfs://${metadataUpload.cid}`,
    certificate: `ipfs://${certCID}`,
    voic: `ipfs://${voicCID}`,
  };
}
