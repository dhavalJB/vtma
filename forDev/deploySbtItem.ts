import { beginCell, toNano } from "@ton/core";
import { SbtItem } from "../wrappers/SbtItem"; // Our SBT wrapper
import { compile, NetworkProvider } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {
  // --- Compile our contract ---
  const code = await compile("SbtItem");

  // --- Create our IPFS metadata content ---
  // ❗ IMPORTANT: REPLACE THIS WITH YOUR REAL IPFS LINK
  // You can re-use your old JSON or make a new one
  const metadataUri =
    "ipfs://bafkreicdtiadk6enrowgbcszl6aw3pe7nu3l5yrykenvx6lt4xnbzhntku"; // <-- ❗ PUT YOUR METADATA HASH HERE

  // Create the content cell WITH the TEP-64 prefix
  const contentCell = beginCell()
    .storeUint(0x01, 8) // The 'off-chain' prefix
    .storeStringTail(metadataUri) // Store the URI as a string
    .endCell();

  // --- Create the deploy config ---
  const config = {
    index: 0n, // 0n for a standalone SBT
    collectionAddress: null, // null for a standalone SBT
    ownerAddress: provider.sender().address!, // The DEPLOYER'S (your) address
    content: contentCell,
  };

  // --- Create an instance of the contract ---
  const sbtItem = provider.open(SbtItem.createFromConfig(config, code));

  // --- Send the deploy transaction ---
  console.log(`Deploying SBT to ${provider.network()}...`);
  console.log(`Owner: ${config.ownerAddress}`);

  await sbtItem.sendDeploy(
    provider.sender(),
    toNano("0.05") // Gas fee
  );

  // --- Wait for the contract to deploy ---
  await provider.waitForDeploy(sbtItem.address);

  console.log("✅ SBT Contract deployed at address:");
  console.log(sbtItem.address.toString());
}
