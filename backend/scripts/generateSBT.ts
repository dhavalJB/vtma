import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';

dotenv.config();

// ========================== ⚙️ Setup ==========================
const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY!,
});

const outputDir = path.resolve('./output');
await fs.mkdir(outputDir, { recursive: true });

// ========================== 🧩 Helpers ==========================
function normalizeGateway(gateway: string) {
    return gateway.replace(/^https?:\/\//, '');
}

async function fileExists(filePath: string) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function saveJSON(data: any, fileName: string) {
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`🧾 Metadata saved → ${filePath}`);
    return filePath;
}

async function uploadFileToPinata(filePath: string, type = 'image/png') {
    const buffer = await fs.readFile(filePath);
    const file = new File([buffer], path.basename(filePath), { type });
    const upload = await pinata.upload.public.file(file);
    const gateway = normalizeGateway(pinata.config.pinataGateway);
    const url = `https://${gateway}/ipfs/${upload.cid}`;
    console.log(`📤 Uploaded → ${url}`);
    return url;
}

// ========================== 🧾 Index Manager ==========================
async function updateMetadataIndex(record: any) {
    const indexPath = path.join(outputDir, 'vishwaspatra_index.json');
    let data = [];
    if (await fileExists(indexPath)) {
        const content = await fs.readFile(indexPath, 'utf8');
        try {
            data = JSON.parse(content);
        } catch {
            data = [];
        }
    }
    data.push(record);
    await fs.writeFile(indexPath, JSON.stringify(data, null, 2));
    console.log('📚 Index updated: vishwaspatra_index.json');
}

// ========================== 🏫 Certificate Generator ==========================
async function generateCertificate({
    institutionName,
    registrationId,
    verifiedBy,
}: {
    institutionName: string;
    registrationId: string;
    verifiedBy: string;
}) {
    const fileName = `Certificate_${institutionName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    const imagePath = path.join(outputDir, fileName);

    const html = `
  <html><head><meta charset="utf-8" />
  <style>
  html, body { margin: 0; padding: 0; width: 1056px; height: 816px; }
  body {
    font-family: 'Poppins', sans-serif;
    background: linear-gradient(135deg, #f9fbff, #eef4ff);
    border: 12px solid #0040ff;
    text-align: center;
    box-sizing: border-box;
    padding: 60px;
    position: relative;
  }
  h1 { font-size: 46px; color: #002d72; margin: 0; }
  .sub { font-size: 20px; color: #0055ff; margin-top: 5px; }
  .content { margin-top: 70px; font-size: 22px; color: #333; line-height: 1.7; }
  .institution { font-weight: bold; font-size: 30px; color: #002d72; margin: 15px 0; text-transform: uppercase; }
  .highlight { color: #0055ff; font-weight: 600; }
  .footer { position: absolute; bottom: 40px; width: 100%; text-align: center; font-size: 16px; color: #444; }
  </style></head>
  <body>
    <h1>VishwasPatra</h1>
    <div class="sub">Official Institution Certification (VOIC)</div>
    <div class="content">
      This is to certify that<br/>
      <div class="institution">${institutionName}</div>
      has been officially verified and accredited by the<br/>
      <span class="highlight">${verifiedBy}</span><br/>
      and is authorized to issue verified documents on<br/>
      the <b>VishwasPatra Network</b>.<br/><br/>
      Certification ID: <b>${registrationId}</b>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} VishwasPatra Network — All Rights Reserved
    </div>
  </body></html>`;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: imagePath });
    await browser.close();

    console.log(`✅ Certificate generated: ${imagePath}`);
    return imagePath;
}

// ========================== 🎫 VOIC Card Generator ==========================
async function generateVOIC({ college, certificateURL }: { college: string; certificateURL: string }) {
    const fileName = `VOIC_${college.replace(/\s+/g, '_')}_${Date.now()}.png`;
    const imagePath = path.join(outputDir, fileName);
    const qrCode = await QRCode.toDataURL(certificateURL);

    const html = `
  <html><head><meta charset="utf-8" />
  <style>
  html, body { margin: 0; padding: 0; width: 420px; height: 620px; }
  body {
    font-family: 'Poppins', sans-serif;
    border: 6px solid #0056ff;
    border-radius: 16px;
    background: linear-gradient(180deg, #f9fbff, #e6f0ff);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 25px 20px;
    text-align: center;
  }
  h1 { font-size: 26px; color: #002a7f; margin: 0; }
  h2 { font-size: 18px; color: #0044ff; margin: 8px 0; }
  p { font-size: 15px; color: #333; margin: 5px 0 20px; }
  .qr img { width: 260px; height: 260px; border: 4px solid #0044ff; border-radius: 12px; }
  .footer { font-size: 12px; color: #555; text-align: center; }
  </style></head>
  <body>
    <div>
      <h1>VISHWAS PATRA</h1>
      <h2>VOIC CERTIFIED</h2>
      <p>Authorized Institution:<br/><b>${college}</b></p>
    </div>
    <div class="qr"><img src="${qrCode}" /></div>
    <div class="footer">
      © ${new Date().getFullYear()} VishwasPatra Network<br/>Powered by TON Blockchain
    </div>
  </body></html>`;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 620, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: imagePath });
    await browser.close();

    console.log(`🎫 VOIC generated: ${imagePath}`);
    return { imagePath, qrCode };
}

// ========================== 🚀 MAIN FLOW ==========================
(async () => {
    const institution = 'Sardar Vallabhbhai Institute of Technology';
    const registrationId = 'VP-IND-2025-042';
    const verifiedBy = 'VishwasPatra Verification Authority';

    // Generate Certificate
    const certPath = await generateCertificate({ institutionName: institution, registrationId, verifiedBy });
    const certURL = await uploadFileToPinata(certPath);

    // Generate VOIC
    const { imagePath: voicPath, qrCode } = await generateVOIC({ college: institution, certificateURL: certURL });
    const voicURL = await uploadFileToPinata(voicPath);

    // Save unified metadata locally (not uploaded)
    const unifiedMetadata = {
        institutionName: institution,
        registrationId,
        verifiedBy,
        issuedAt: new Date().toISOString(),
        certificate: {
            fileName: path.basename(certPath),
            ipfsUrl: certURL,
        },
        voic: {
            fileName: path.basename(voicPath),
            ipfsUrl: voicURL,
            linkedCertificate: certURL,
            qrCode,
        },
    };

    await saveJSON(unifiedMetadata, `${institution.replace(/\s+/g, '_')}_metadata.json`);

    // Update Global Index
    await updateMetadataIndex({
        institution,
        registrationId,
        certificate: certURL,
        voic: voicURL,
        issuedAt: unifiedMetadata.issuedAt,
    });

    console.log('\n✅ FINAL OUTPUTS');
    console.log('📜 Certificate URL:', certURL);
    console.log('🎫 VOIC URL:', voicURL);
})();
