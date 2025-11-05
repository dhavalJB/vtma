import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address } from "ton-core";

export async function verifySBTonTON(
  wallet: string,
  college: string,
  deployAddress: string
): Promise<boolean> {
  try {
    const endpoint = await getHttpEndpoint({ network: "testnet" });
    const client = new TonClient({ endpoint });

    console.log("🔍 Checking SBT for:", wallet, `VishwasPatra - ${college}`);
    const address = Address.parse(deployAddress);

    const state = await client.getContractState(address);
    if (!state || !state.code) {
      console.log("❌ Contract not found or inactive");
      return false;
    }

    // 🔹 Run get_nft_data()
    const result = await client.runMethod(address, "get_nft_data");
    const stack = result.stack;

    const inited = stack.readBoolean();
    const index = stack.readBigNumber();

    // ✅ Safe readAddress helper
    const safeReadAddress = () => {
      try {
        return stack.readAddress();
      } catch {
        return null; // in case of addr_none
      }
    };

    const collection = safeReadAddress();
    const owner = safeReadAddress();
    const content = stack.readCell();

    console.log("📦 index:", index.toString());
    console.log("🏛 collection:", collection?.toString() || "none");
    console.log("👤 owner:", owner?.toString() || "none");
    console.log("🧩 content cell bits:", content.bits.length);

    if (!owner) {
      console.log("⚠️ No owner found (addr_none) — probably uninitialized NFT");
      return false;
    }

    const verified = owner.equals(Address.parse(wallet));
    console.log("✅ Owner match:", verified);

    return verified;
  } catch (err) {
    console.error("❌ Error verifying SBT on TON:", err);
    return false;
  }
}
