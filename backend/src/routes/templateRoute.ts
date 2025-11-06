import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";

// ⚠️ FIX: Importing FieldValue directly from the Admin SDK for correct usage.
// Assuming your firebaseConfig exports `db` as the admin.firestore() instance.
import { db } from "../config/firebaseConfig";
import { FieldValue } from "firebase-admin/firestore"; // <-- Correct Admin SDK import

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Chunking Utilities (Backend Version) ---
// Using 500 KB to be safe under the 1MB Firestore document limit
const CHUNK_SIZE = 500 * 1024;

// Helper to generate a unique ID (Admin SDK could also use doc().id)
const generateUUID = (): string =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

/**
 * Splits the content buffer (converted to a base64 string) into fixed-size chunks.
 * We use base64 encoding to ensure all data is safely represented as a string.
 */
const chunkContent = (content: string): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.substring(i, i + CHUNK_SIZE));
  }
  return chunks;
};
// --- End Chunking Utilities ---

// Extend Request type
interface MulterRequest extends Request {
  file?: Express.Multer.File; // optional
}

router.post(
  "/temp-upload",
  upload.single("file"),
  async (req: MulterRequest, res: Response) => {
    try {
      const { mockID, type, certificateName } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "No file uploaded" });
      if (!mockID) return res.status(400).json({ error: "Missing mockID" });

      // 1. Convert Buffer to Base64 String for chunking (safer than raw UTF8 for large files)
      const rawContentBase64 = file.buffer.toString("base64");

      // 2. Chunk the content
      const chunks = chunkContent(rawContentBase64);
      const templateId = generateUUID();

      console.log(
        `File received: ${file.originalname}. Size: ${file.size} bytes. Chunking into ${chunks.length} pieces.`
      );

      // 3. Upload Chunks to Firestore Subcollection
      const batch = db.batch();

      // Path: template_chunks/{templateId}/data/{index}
      const templateChunksCollection = db
        .collection("template_chunks")
        .doc(templateId)
        .collection("data");

      chunks.forEach((content, index) => {
        const chunkDocRef = templateChunksCollection.doc(index.toString());
        batch.set(chunkDocRef, {
          index: index,
          content: content, // The Base64 encoded chunk
          uploadedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      // 4. Prepare and Update College Metadata (Reference)
      const collegeRef = db.collection("colleges").doc(mockID);
      const templatePath = `templates.${path
        .parse(file.originalname)
        .name.replace(/\./g, "_")}`;

      const newTemplateMetadata = {
        templateId: templateId, // Reference ID to the chunks subcollection
        chunkCount: chunks.length,
        type: type || "Degree",
        certificateName: certificateName || path.parse(file.originalname).name,
        uploadedAt: new Date().toISOString(),
      };

      // 5. Use the imported FieldValue to perform the arrayUnion update
      await collegeRef.update({
        templates: FieldValue.arrayUnion(newTemplateMetadata), // <-- FIX APPLIED HERE
      });

      console.log(`✅ Chunked Upload Successful. Template ID: ${templateId}`);
      console.log(`✅ Firestore Reference Updated: colleges/${mockID}`);

      return res.status(200).json({
        message: `File uploaded successfully in ${chunks.length} chunks.`,
        templateId: templateId,
        chunkCount: chunks.length,
      });
    } catch (err) {
      console.error("❌ Firestore Chunking/Storage Error:", err);
      return res
        .status(500)
        .json({ error: "Internal Server Error during chunked storage" });
    }
  }
);

export default router;
