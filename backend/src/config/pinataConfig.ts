// src/config/pinataConfig.ts
import { PinataSDK } from "pinata";
import dotenv from "dotenv";

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

export { pinata, normalizeGateway };
