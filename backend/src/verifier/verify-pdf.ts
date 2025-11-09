import { Request, Response } from "express";
import { PDFDocument } from "pdf-lib";
import formidable from "formidable";
import fs from "fs/promises";
import { db } from "../config/firebaseConfig"; // ✅ Firebase Admin SDK
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
  };
  studentId?: string;
  templateId?: string;
  pdfIpfs?: string;
  metaUri?: string;
  mintedAt?: string;
  [key: string]: any;
}

export const verifyPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🔍 Starting PDF verification...");

    // 🧾 Parse uploaded PDF
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);
    const file = (files.file as formidable.File[])?.[0];

    if (!file) {
      res.status(400).json({ error: "No PDF uploaded" });
      return;
    }

    // 📄 Load and extract metadata
    const pdfBytes = await fs.readFile(file.filepath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const subject = pdfDoc.getSubject();
    const keywords = pdfDoc.getKeywords();

    let compositeHash = "—";
    let version = "—";

    if (keywords && typeof keywords === "string") {
      try {
        const parsed = JSON.parse(keywords);
        compositeHash = parsed.compositeHash || "—";
        version = parsed.version || "—";
      } catch {
        console.warn("⚠️ Could not parse keywords JSON.");
      }
    }

    console.log(
      `📄 PDF Extracted | Title: ${title || "—"} | Issuer: ${
        author || "—"
      } | Hash: ${compositeHash}`
    );

    if (compositeHash === "—") {
      res.json({
        verified: false,
        status: "⚠️ Invalid PDF",
        message: "Composite hash missing in PDF metadata.",
      });
      return;
    }

    // 🔍 Step 1: Check hash registry
    const registrySnap = await db
      .collection("compositeRegistry")
      .doc(compositeHash)
      .get();

    if (!registrySnap.exists) {
      res.json({
        verified: false,
        status: "❌ Unregistered PDF",
        message: "No record found for this certificate hash.",
      });
      return;
    }

    const registryData = registrySnap.data() as RegistryData;
    if (!registryData) throw new Error("Registry data undefined.");

    console.log("📘 Found registry entry:", registryData);

    // 🔍 Step 2: Get certificate record
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
        message: "Certificate record not found in Firestore.",
      });
      return;
    }

    const certData = certSnap.data() as CertData;
    if (!certData) throw new Error("Certificate data undefined.");

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
        ? `✅ VERIFIED: ${registryData.certificateId} is authentic.`
        : `❌ INVALID: ${registryData.certificateId} hash mismatch.`
    );

    res.json({
      verified,
      compositeHash,
      recomputedHash,
      version,
      certificateId: registryData.certificateId,
      collegeId: registryData.collegeId,
      studentId: registryData.studentId,
      message: verified
        ? "✅ Certificate verified successfully."
        : "❌ Invalid or tampered certificate.",
    });
  } catch (error) {
    const err = error as Error;
    console.error("❌ Error verifying PDF:", err.message);
    res.status(500).json({ error: err.message });
  }
};
