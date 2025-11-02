import { toNano } from '@ton/core';
import { VoicSBT } from '../wrappers/VoicSBT';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const voicSBT = provider.open(VoicSBT.createFromConfig({}, await compile('VoicSBT')));

    await voicSBT.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(voicSBT.address);

    // run methods on `voicSBT`
}
