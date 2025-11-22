// src/utils/firestoreTemplateUtils.ts
import { db } from "../firebaseConfig";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

export interface TemplateMetadata {
  templateId: string;
  name?: string;
  certificateName?: string;
  chunkCount?: number;
}

export async function fetchTemplateContentFromFirestore(
  template: TemplateMetadata,
  CHUNK_BASE_COLLECTION = "template_chunks"
): Promise<string> {
  if (!template.templateId || !template.chunkCount) {
    throw new Error(
      `Invalid template metadata: missing templateId or chunkCount`
    );
  }

  // template_chunks/{templateId}/data
  const chunksCollectionRef = collection(
    db,
    `${CHUNK_BASE_COLLECTION}/${template.templateId}/data`
  );

  const q = query(chunksCollectionRef, orderBy("index", "asc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error(`No chunks found for template ID: ${template.templateId}`);
  }

  const parts: string[] = snapshot.docs.map((doc) => doc.data().content);
  let fullContent = parts.join("");

  if (fullContent.trim().startsWith("PCFET0")) {
    try {
      fullContent = atob(fullContent);
      console.log(" Base64 decoded successfully.");
    } catch (e) {
      console.warn(" Failed to decode Base64, showing raw content instead.");
    }
  }

  return fullContent;
}
