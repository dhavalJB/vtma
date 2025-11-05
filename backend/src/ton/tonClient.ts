import { TonClient, WalletContractV4, Cell, Sender, toNano } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "@ton/crypto";

// --- IMPORT YOUR PRE-COMPILED CONTRACT ---
// Adjust the path to where your compiled JSON file is located.
// This is typically in the 'build' folder.
import * as sbtItemCompiled from "./build/SbtItem.compiled.json";

// Global variables to hold our initialized instances
export let tonClient: TonClient;
export let sbtCodeCell: Cell;
export let adminWallet: WalletContractV4;
export let adminSender: Sender;

export async function initializeTon() {
  console.log("🔵 Initializing TON client and setting up admin wallet...");

  // 1. Initialize TON Client
  const endpoint = await getHttpEndpoint({ network: "testnet" });
  tonClient = new TonClient({ endpoint });

  // 2. Load Pre-compiled Contract Code
  try {
    // Parse the hex string from the compiled JSON file into a Buffer
    const bocBuffer = Buffer.from(sbtItemCompiled.hex, "hex");
    // Deserialize the Buffer into a Cell
    sbtCodeCell = Cell.fromBoc(bocBuffer)[0];
    console.log("✅ Pre-compiled contract code loaded successfully.");
  } catch (e: any) {
    console.error("❌ Failed to load pre-compiled contract:", e.message);
    process.exit(1); // Exit if loading fails
  }

  // 3. Setup Admin/Deployer Wallet
  const mnemonic = process.env.ADMIN_MNEMONIC; // Get from .env
  if (!mnemonic) {
    throw new Error(
      "ADMIN_MNEMONIC is not set in .env file. This wallet pays for deployment gas."
    );
  }

  const key = await mnemonicToWalletKey(mnemonic.split(" "));
  adminWallet = WalletContractV4.create({
    publicKey: key.publicKey,
    workchain: 0,
  });

  // Check if admin wallet has balance
  const balance = await tonClient.getBalance(adminWallet.address);
  console.log(`Admin Wallet Balance: ${Number(balance) / 1e9} TON`);
  if (balance < toNano("0.1")) {
    console.warn(
      `🚨 WARNING: Admin wallet ${adminWallet.address.toString()} has a low balance. Deployments may fail.`
    );
  }

  // Create a contract instance for the admin wallet
  const walletContract = tonClient.open(adminWallet);

  // Create a sender object
  adminSender = walletContract.sender(key.secretKey);

  console.log("✅ TON Client, Admin Wallet, and Contract Code are ready.");
  console.log(`Admin Wallet Address: ${adminWallet.address.toString()}`);
}
