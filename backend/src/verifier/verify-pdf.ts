import { Request, Response } from "express";
import { PDFDocument } from "pdf-lib";
import formidable from "formidable";
import fs from "fs/promises";
import { db } from "../config/firebaseConfig";
import crypto from "crypto-js";

interface RegistryData {
  collegeId: string;
  studentId: string;
  certificateId: string;
  [key: string]: any;
}

interface CertData {
  collegeContractAddress?: string;
  studentContractAddress?: string;
  collegeDetails?: {
    fullName?: string;
    shortName?: string;
    regId?: string;
    logo?: any[];
  };
  studentId?: string;
  templateId?: string;
  pdfIpfs?: string;
  pdfUrl?: string;
  metaUri?: string;
  mintedAt?: string;
  [key: string]: any;
}

export const verifyPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🔍 Starting VishwasPatra verification...");

    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);

    let compositeHash = fields.hash?.[0]; // ✅ hash passed directly from frontend
    let file = (files.file as formidable.File[])?.[0];

    // 🧾 If PDF is uploaded, extract its metadata
    if (file) {
      console.log("📄 Reading uploaded PDF file...");
      const pdfBytes = await fs.readFile(file.filepath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const keywords = pdfDoc.getKeywords();

      if (keywords && typeof keywords === "string") {
        try {
          const parsed = JSON.parse(keywords);
          compositeHash = parsed.compositeHash || compositeHash;
        } catch {
          console.warn("⚠️ Could not parse PDF keywords as JSON.");
        }
      }
    }

    if (!compositeHash) {
      res.status(400).json({
        verified: false,
        status: "⚠️ Invalid Request",
        message: "No hash or PDF found for verification.",
      });
      return;
    }

    console.log("🔗 Composite Hash:", compositeHash);

    // 🔍 Step 1: Find registry record
    const registrySnap = await db
      .collection("compositeRegistry")
      .doc(compositeHash)
      .get();

    if (!registrySnap.exists) {
      res.json({
        verified: false,
        status: "❌ Unregistered Certificate",
        message: "No record found for this certificate hash.",
      });
      return;
    }

    const registryData = registrySnap.data() as RegistryData;
    console.log("📘 Registry Found:", registryData);

    // 🔍 Step 2: Fetch Firestore certificate data
    const certSnap = await db
      .collection("colleges")
      .doc(registryData.collegeId)
      .collection("students")
      .doc(registryData.studentId)
      .collection("certificates")
      .doc(registryData.certificateId)
      .get();

    if (!certSnap.exists) {
      res.json({
        verified: false,
        status: "⚠️ Record mismatch",
        message: "Certificate not found under registered student record.",
      });
      return;
    }

    const certData = certSnap.data() as CertData;
    console.log("🎓 Certificate Data:", certData);

    // 🧩 Step 3: Recompute hash
    const fieldsForHash: Record<string, any> = {
      collegeContractAddress: certData.collegeContractAddress,
      studentContractAddress: certData.studentContractAddress,
      collegeId: registryData.collegeId,
      collegeFullName: certData.collegeDetails?.fullName,
      collegeShortName: certData.collegeDetails?.shortName,
      collegeRegId: certData.collegeDetails?.regId,
      studentId: registryData.studentId,
      templateId: certData.templateId,
      pdfIpfs: certData.pdfIpfs,
      metaUri: certData.metaUri,
      mintedAt: certData.mintedAt,
    };

    const canonical = JSON.stringify(
      Object.keys(fieldsForHash)
        .sort()
        .reduce((obj: Record<string, any>, key) => {
          obj[key] = fieldsForHash[key];
          return obj;
        }, {})
    );

    const recomputedHash = crypto
      .SHA256("VISHWASPATRA:v1|" + canonical)
      .toString();

    // ✅ Step 4: Compare
    const verified = recomputedHash === compositeHash;
    console.log(
      verified
        ? `✅ VERIFIED — Authentic document for ${registryData.certificateId}`
        : `❌ INVALID — Hash mismatch for ${registryData.certificateId}`
    );

    // 🏛️ Extract logo
    let logoImage = "";
    try {
      const logoArray = certData.collegeDetails?.logo;
      if (Array.isArray(logoArray) && logoArray.length > 0) {
        logoImage = logoArray[0]?.normalImage || "";
      }
    } catch (e) {
      console.warn("⚠️ Could not extract college logo image.");
    }

    // 🧾 Response
    res.json({
      verified,
      status: verified ? "✅ Authentic Certificate" : "❌ Verification Failed",
      message: verified
        ? "This certificate has been verified as authentic and untampered."
        : "This certificate appears to be modified or invalid.",
      compositeHash,
      recomputedHash,
      certificateId: registryData.certificateId,
      collegeId: registryData.collegeId,
      studentId: registryData.studentId,
      collegeName: certData.collegeDetails?.fullName || "Unknown College",
      collegeShortName: certData.collegeDetails?.shortName || "",
      collegeRegId: certData.collegeDetails?.regId || "",
      logoImage,
      pdfUrl: certData.pdfUrl || "",
      issuedTo: certData.studentId || "",
      issuedAt: certData.mintedAt || "",
      studentContractAddress: certData.studentContractAddress || "",
    });
  } catch (error) {
    const err = error as Error;
    console.error("❌ Verification Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
