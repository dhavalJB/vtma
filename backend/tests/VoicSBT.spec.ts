import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { VoicSBT } from '../wrappers/VoicSBT';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('VoicSBT', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('VoicSBT');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let voicSBT: SandboxContract<VoicSBT>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        voicSBT = blockchain.openContract(VoicSBT.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await voicSBT.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: voicSBT.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and voicSBT are ready to use
    });
});
