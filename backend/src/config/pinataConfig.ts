// src/config/pinataConfig.ts
import { PinataSDK } from "pinata";
import dotenv from "dotenv";
import { File } from "buffer";

dotenv.config();

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

// Helper function to normalize the gateway URL
function normalizeGateway(gateway?: string) {
  return (gateway ?? "https://gateway.pinata.cloud").replace(
    /^https?:\/\//,
    ""
  );
}

export async function uploadBufferToPinata(buffer: Buffer, fileName: string) {
  const mimeType = fileName.endsWith(".json") ? "application/json" : "image/png";
  const file = new File([buffer], fileName, { type: mimeType });
  const upload = await pinata.upload.public.file(file as any);
  const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
  const url = `https://${normalizeGateway(gateway)}/ipfs/${upload.cid}`;
  console.log(`📤 Uploaded → ${url}`);
  return { url, cid: upload.cid };
}

export { pinata, normalizeGateway };
