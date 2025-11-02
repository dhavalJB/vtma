import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type VoicSBTConfig = {};

export function voicSBTConfigToCell(config: VoicSBTConfig): Cell {
    return beginCell().endCell();
}

export class VoicSBT implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new VoicSBT(address);
    }

    static createFromConfig(config: VoicSBTConfig, code: Cell, workchain = 0) {
        const data = voicSBTConfigToCell(config);
        const init = { code, data };
        return new VoicSBT(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
