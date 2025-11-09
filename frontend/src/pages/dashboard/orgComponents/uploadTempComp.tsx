import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";

// Assuming these imports correctly point to your Firebase Client SDK configuration
import { db } from "../../../firebaseConfig";
import { useSession } from "../../../App";

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  getDocs,
  arrayUnion,
  orderBy,
} from "firebase/firestore";

import { fetchTemplateContentFromFirestore } from "../../../utils/firestoreTemplateUtils";

// --- Chunking Utilities & Constants ---
// Using 500 KB to be safe under the 1MB Firestore document limit
const CHUNK_SIZE = 500 * 1024;

const generateUUID = (): string =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

/**
 * Splits the content string into fixed-size chunks.
 */
const chunkContent = (content: string): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.substring(i, i + CHUNK_SIZE));
  }
  return chunks;
};
// --- End Chunking Utilities ---

export default function UploadTempComp() {
  const location = useLocation();
  const { session } = useSession(); // Use the user ID to ensure path isolation if needed, though 'colleges' is public in the backend
  const mockID = location.state?.mockID || session?.mockID || "MOCK_COLLEGE_ID";

  const [collegeDetails, setCollegeDetails] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawFileContent, setRawFileContent] = useState<string | null>(null); // To store file content string
  const [certificateName, setCertificateName] = useState("");
  const [type, setType] = useState("Degree");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalTemplate, setModalTemplate] = useState<any>(null);
  const [message, setMessage] = useState("");

  // ⚠️ NEW STATE: Controls the view inside the template modal (Preview vs Source Code)
  const [modalView, setModalView] = useState<"preview" | "source">("preview");

  // Hardcoded for public access based on backend rules
  const COLLEGES_COLLECTION = "colleges";
  const CHUNK_BASE_COLLECTION = "template_chunks";

  useEffect(() => {
    if (!mockID) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const collegeSnap = await getDoc(doc(db, COLLEGES_COLLECTION, mockID));
        if (collegeSnap.exists()) {
          const data = collegeSnap.data();
          setCollegeDetails(data);
          // ⚠️ FIX: Assuming templates are now stored as an Array (using arrayUnion)
          setTemplates(data?.templates || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setMessage("Error fetching data. Check console.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mockID]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);

    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setRawFileContent(result);
        setMessage(
          `File loaded: ${uploadedFile.name}. Size: ${(
            uploadedFile.size /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
      } else {
        console.warn("⚠️ File content was not a string.");
        setMessage("Unexpected file format.");
        setRawFileContent(null);
      }
    };

    reader.onerror = () => {
      console.error("❌ Error reading file.");
      setMessage("Error reading file.");
      setRawFileContent(null);
    };

    // Read HTML/text content
    reader.readAsText(uploadedFile);
  };

  const uploadTemplate = async () => {
    if (
      !file ||
      !rawFileContent ||
      !certificateName ||
      !type ||
      !collegeDetails.shortName
    ) {
      setMessage("Missing file content, name, type, or college short name.");
      return;
    }
    setUploading(true);
    setMessage("");

    // 1. Chunk the file content
    const chunks = chunkContent(rawFileContent);
    const templateId = generateUUID();

    if (chunks.length === 0) {
      setMessage("File content is empty or could not be chunked.");
      setUploading(false);
      return;
    }

    // 2. Upload Chunks to the dedicated subcollection (Client SDK version)
    // Path: template_chunks/{templateId}/data/{index}
    const chunkPromises = chunks.map((content, index) => {
      const chunkDocRef = doc(
        db,
        `${CHUNK_BASE_COLLECTION}/${templateId}/data/${index.toString()}`
      );
      // Note: The content is the raw string chunk (Base64 is also an option but string is cleaner for HTML text)
      return setDoc(chunkDocRef, {
        index: index,
        content: content,
        uploadedAt: new Date().toISOString(),
      });
    });

    try {
      await Promise.all(chunkPromises);

      // 3. Prepare template metadata (reference) for Firestore
      const newTemplateMetadata = {
        name: `${collegeDetails.shortName}-${type}-${certificateName}.html`,
        type: type,
        templateId: templateId, // Reference ID
        chunkCount: chunks.length,
        certificateName: certificateName,
        uploadedAt: new Date().toISOString(),
      };

      // 4. Update College Metadata document (using arrayUnion)
      const docRef = doc(db, COLLEGES_COLLECTION, mockID);
      await updateDoc(docRef, {
        templates: arrayUnion(newTemplateMetadata),
      });

      // 5. Update local state and UI
      setTemplates((prev) => [...prev, newTemplateMetadata]);

      setFile(null);
      setRawFileContent(null);
      setCertificateName("");
      setType("Degree");
      setShowUploadModal(false);
      setMessage(
        `Template "${certificateName}" saved in ${chunks.length} chunks! Template ID: ${templateId}`
      );
    } catch (err: any) {
      console.error("❌ Error during chunked upload:", err);
      setMessage(`An error occurred: ${err.message}. Check console.`);
    } finally {
      setUploading(false);
    }
  };

  // --- Function: Retrieve and Reassemble Content ---
  const fetchTemplateContent = async (template: any) => {
    try {
      const fullContent = await fetchTemplateContentFromFirestore(template);

      setModalTemplate({
        ...template,
        htmlContent: fullContent,
        url: fullContent,
      });
      setModalView("preview");
      setMessage(`✅ Retrieved ${template.certificateName}`);
    } catch (err: any) {
      console.error("❌ Error fetching template:", err);
      setMessage(`Failed: ${err.message}`);
    }
  };
  // --- End Function ---

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-10 font-sans">
      {" "}
      <div className="max-w-6xl mx-auto">
        {/* Header */}{" "}
        <header className="mb-10 text-center">
          {" "}
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
            Certificate Templates ({collegeDetails?.shortName || mockID}){" "}
          </h1>{" "}
          <span className="text-xs font-mono text-gray-400">
            Mock ID: {mockID}
          </span>{" "}
        </header>
        {/* Message Bar */}
        {message && (
          <div
            className="bg-indigo-100 border border-indigo-400 text-indigo-700 px-4 py-3 rounded-xl relative mb-6 text-sm"
            role="alert"
          >
            <span className="block sm:inline">{message}</span>
          </div>
        )}
        {/* Upload Button */}{" "}
        <div className="mb-8 flex justify-center">
          {" "}
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-6 py-3 shadow-md hover:shadow-lg transition"
          >
            Upload New Template (Chunked){" "}
          </button>{" "}
        </div>
        {/* Template Grid */}{" "}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {" "}
          {loading ? (
            <p className="text-center col-span-full text-gray-500">
              Loading templates...{" "}
            </p>
          ) : templates.length === 0 ? (
            <p className="text-center col-span-full text-gray-500">
              No templates yet. Upload one!{" "}
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.templateId}
                className="bg-white rounded-2xl shadow-md p-5 flex flex-col justify-between hover:shadow-xl transition"
              >
                {" "}
                <div className="flex flex-col gap-1">
                  {" "}
                  <h2 className="font-semibold text-lg text-gray-900 truncate">
                    {t.certificateName}{" "}
                  </h2>{" "}
                  <span className="text-sm text-gray-500">Type: {t.type}</span>
                  <span className="text-xs text-gray-400">
                    Chunks: {t.chunkCount}
                  </span>{" "}
                </div>{" "}
                <div className="mt-4 flex justify-between items-center">
                  {" "}
                  <button
                    // Triggers content fetch and opens the modal
                    onClick={() => fetchTemplateContent(t)}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    View Certificate{" "}
                  </button>{" "}
                </div>{" "}
              </div>
            ))
          )}{" "}
        </section>
        {/* Upload Modal (unchanged) */}{" "}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            {" "}
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
              {" "}
              <button
                onClick={() => setShowUploadModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              >
                ✕{" "}
              </button>{" "}
              <h2 className="text-xl font-semibold mb-4">Upload Template</h2>{" "}
              <input
                type="text"
                placeholder="Certificate Name"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 mb-4 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />{" "}
              <h3 className="text-gray-700 font-medium mb-2">
                Certificate Type{" "}
              </h3>{" "}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {" "}
                {["Degree", "Certificate"].map((t) => (
                  <button
                    key={t}
                    className={`py-2 px-3 rounded-lg font-medium text-sm border transition 
         ${
           type === t
             ? "bg-indigo-600 text-white border-indigo-600"
             : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
         }`}
                    onClick={() => setType(t)}
                  >
                    {t}{" "}
                  </button>
                ))}{" "}
              </div>{" "}
              <div className="mb-4 relative">
                {" "}
                <input
                  type="file"
                  id="file-upload"
                  accept=".html" // Ensure only HTML files are accepted
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div
                  className={`border-2 border-dashed rounded-lg py-6 text-center transition ${
                    file
                      ? "border-green-500 text-green-600"
                      : "border-gray-300 text-gray-400 hover:border-indigo-500 hover:text-indigo-600"
                  }`}
                >
                  {file
                    ? `File ready: ${file.name}. Size: ${(
                        file.size /
                        1024 /
                        1024
                      ).toFixed(2)} MB`
                    : "Drag & Drop or Click to Upload (.html file)"}{" "}
                </div>{" "}
              </div>{" "}
              <button
                onClick={uploadTemplate}
                disabled={!rawFileContent || uploading || !certificateName}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2 w-full transition disabled:opacity-50"
              >
                {" "}
                {uploading
                  ? "Saving Chunks..."
                  : "Upload (Uses Client-Side Chunking)"}{" "}
              </button>{" "}
            </div>{" "}
          </div>
        )}
        {/* View Modal (Updated to include Source Code view) */}{" "}
        {modalTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            {" "}
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 relative">
              {" "}
              <button
                onClick={() => setModalTemplate(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl"
              >
                ✕{" "}
              </button>{" "}
              <h2 className="text-xl font-semibold mb-4 pr-10">
                Template: {modalTemplate.certificateName}{" "}
              </h2>
              {/* Tab Controls */}
              <div className="flex border-b mb-4">
                <button
                  onClick={() => setModalView("preview")}
                  className={`px-4 py-2 font-medium text-sm transition ${
                    modalView === "preview"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-indigo-600"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setModalView("source")}
                  className={`px-4 py-2 font-medium text-sm transition ${
                    modalView === "source"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-indigo-600"
                  }`}
                >
                  Source Code
                </button>
              </div>
              {/* Content Area */}
              <div className="h-[60vh]">
                {modalView === "preview" ? (
                  // The iframe uses a Data URL for live preview
                  <iframe
                    srcDoc={modalTemplate.url}
                    title={modalTemplate.name}
                    className="w-full h-full rounded-lg border"
                  />
                ) : (
                  // Display the raw HTML content
                  <textarea
                    readOnly
                    value={modalTemplate.htmlContent}
                    className="w-full h-full p-4 font-mono text-xs border border-gray-300 rounded-lg resize-none bg-gray-50"
                    placeholder="Loading source code..."
                  />
                )}
              </div>{" "}
            </div>{" "}
          </div>
        )}{" "}
      </div>{" "}
    </div>
  );
}
