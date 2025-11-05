import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from "ton";

// This is our contract's configuration data, which will be stored on-chain
export type SbtItemConfig = {
  index: bigint;
  collectionAddress: Address | null;
  ownerAddress: Address;
  content: Cell;
};

// Helper function to build the initial storage data
export function sbtItemConfigToCell(config: SbtItemConfig): Cell {
  return beginCell()
    .storeInt(config.index, 64)
    .storeAddress(config.collectionAddress)
    .storeAddress(config.ownerAddress)
    .storeRef(config.content)
    .endCell();
}

export class SbtItem implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  // Method to create an instance from our config
  static createFromConfig(config: SbtItemConfig, code: Cell, workchain = 0) {
    const data = sbtItemConfigToCell(config);
    const init = { code, data };
    return new SbtItem(contractAddress(workchain, init), init);
  }

  // --- Message Sending Functions ---

  // 1. Send Deploy
  // This message is sent to deploy the contract
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(), // Empty body for a deploy message
    });
  }

  // NOTE: There is no 'sendTransfer' function because an SBT
  // cannot be transferred.

  // --- Get-Method Functions ---

  // Calls your 'get_nft_data' get-method
  async getNftData(provider: ContractProvider) {
    const result = await provider.get("get_nft_data", []);

    // Parse the result from the stack
    const isInitialized = result.stack.readBoolean();
    const index = result.stack.readBigNumber();
    const collectionAddress = result.stack.readAddressOpt();
    const ownerAddress = result.stack.readAddressOpt();
    const content = result.stack.readCell();

    return {
      isInitialized,
      index,
      collectionAddress,
      ownerAddress,
      content,
    };
  }
}
