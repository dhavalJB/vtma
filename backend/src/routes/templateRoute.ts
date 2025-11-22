import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";


import { db } from "../config/firebaseConfig";
import { FieldValue } from "firebase-admin/firestore"; 

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

const CHUNK_SIZE = 500 * 1024;

const generateUUID = (): string =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);


const chunkContent = (content: string): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.substring(i, i + CHUNK_SIZE));
  }
  return chunks;
};

interface MulterRequest extends Request {
  file?: Express.Multer.File;
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

      const rawContentBase64 = file.buffer.toString("base64");

      const chunks = chunkContent(rawContentBase64);
      const templateId = generateUUID();

      console.log(
        `File received: ${file.originalname}. Size: ${file.size} bytes. Chunking into ${chunks.length} pieces.`
      );

      const batch = db.batch();

      const templateChunksCollection = db
        .collection("template_chunks")
        .doc(templateId)
        .collection("data");

      chunks.forEach((content, index) => {
        const chunkDocRef = templateChunksCollection.doc(index.toString());
        batch.set(chunkDocRef, {
          index: index,
          content: content,
          uploadedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      const collegeRef = db.collection("colleges").doc(mockID);
      const templatePath = `templates.${path
        .parse(file.originalname)
        .name.replace(/\./g, "_")}`;

      const newTemplateMetadata = {
        templateId: templateId, 
        chunkCount: chunks.length,
        type: type || "Degree",
        certificateName: certificateName || path.parse(file.originalname).name,
        uploadedAt: new Date().toISOString(),
      };

      await collegeRef.update({
        templates: FieldValue.arrayUnion(newTemplateMetadata),
      });

      console.log(` Chunked Upload Successful. Template ID: ${templateId}`);
      console.log(` Firestore Reference Updated: colleges/${mockID}`);

      return res.status(200).json({
        message: `File uploaded successfully in ${chunks.length} chunks.`,
        templateId: templateId,
        chunkCount: chunks.length,
      });
    } catch (err) {
      console.error(" Firestore Chunking/Storage Error:", err);
      return res
        .status(500)
        .json({ error: "Internal Server Error during chunked storage" });
    }
  }
);

export default router;
