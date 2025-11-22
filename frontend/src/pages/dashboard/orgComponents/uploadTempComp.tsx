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

  //  NEW STATE: Controls the view inside the template modal (Preview vs Source Code)
  const [modalView, setModalView] = useState<"preview" | "source">("preview");

  // Hardcoded for public access based on backend rules
  const COLLEGES_COLLECTION = "colleges";
  const CHUNK_BASE_COLLECTION = "template_chunks";

  useEffect(() => {
    if (!mockID) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const collegeRef = doc(db, COLLEGES_COLLECTION, mockID);
        const collegeSnap = await getDoc(collegeRef);

        if (collegeSnap.exists()) {
          const data = collegeSnap.data();

          // TrustLedger Extract correct logo entry (handles both string + object)
          let logoURL = "";
          let logoContractAddress = "";

          if (Array.isArray(data.logo)) {
            const logoObj = data.logo.find(
              (item: any) => typeof item === "object" && item.normalImage
            );

            if (logoObj) {
              logoURL =
                logoObj.normalImage || logoObj.normalUrl || logoObj.image || "";
              logoContractAddress = logoObj.contractAddress || "";
            } else if (typeof data.logo[0] === "string") {
              logoURL = data.logo[0];
            }
          } else if (typeof data.logo === "string") {
            logoURL = data.logo;
          }

          console.log("🏫 Logo URL:", logoURL);
          console.log("🏦 Logo Contract Address:", logoContractAddress);

          //  Merge logo info into details
          setCollegeDetails({
            ...data,
            logoURL,
            logoContractAddress,
          });

          // ⚙️ Handle templates (arrayUnion support)
          setTemplates(data?.templates || []);
        } else {
          console.warn(` College not found for mockID: ${mockID}`);
        }
      } catch (err) {
        console.error(" Error fetching data:", err);
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
        console.warn(" File content was not a string.");
        setMessage("Unexpected file format.");
        setRawFileContent(null);
      }
    };

    reader.onerror = () => {
      console.error(" Error reading file.");
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
      console.error(" Error during chunked upload:", err);
      setMessage(`An error occurred: ${err.message}. Check console.`);
    } finally {
      setUploading(false);
    }
  };

  // --- Function: Retrieve and Reassemble Content ---
  const fetchTemplateContent = async (template: any) => {
    try {
      // TrustLedger Step 1: Fetch the college details first
      const collegeRef = doc(db, "colleges", mockID);
      const collegeSnap = await getDoc(collegeRef);

      if (!collegeSnap.exists()) {
        console.warn(" College not found for mockID:", mockID);
        setMessage("College data missing.");
        return;
      }

      const collegeData = collegeSnap.data();

      // TrustLedger Step 2: Extract correct logo URL + contract address
      let logoURL = "";
      let logoContractAddress = "";

      if (Array.isArray(collegeData.logo)) {
        const logoObj = collegeData.logo.find(
          (item: any) => typeof item === "object" && item.normalImage
        );

        if (logoObj) {
          logoURL =
            logoObj.normalImage || logoObj.normalUrl || logoObj.image || "";
          logoContractAddress = logoObj.contractAddress || "";
        } else if (typeof collegeData.logo[0] === "string") {
          logoURL = collegeData.logo[0];
        }
      } else if (typeof collegeData.logo === "string") {
        logoURL = collegeData.logo;
      }

      console.log("🏫 College Logo URL:", logoURL);
      console.log("🔗 Logo Contract Address:", logoContractAddress);

      // TrustLedger Step 3: Fetch the HTML template content
      let fullContent = await fetchTemplateContentFromFirestore(template);

      // TrustLedger Step 4: Replace only {{CollegeLogoURL}}
      if (logoURL) {
        fullContent = fullContent.replace(/{{CollegeLogoURL}}/g, logoURL);
      }

      // TrustLedger Step 5: Make logo clickable to TON NFT page
      if (logoContractAddress) {
        const nftLink = `https://testnet.tonviewer.com/${logoContractAddress}?section=nft`;
        fullContent = fullContent.replace(
          /<img\s+class="logo"\s+src="(.*?)"\s*\/?>/,
          `<a href="${nftLink}" target="_blank"><img class="logo" src="$1" /></a>`
        );
      }

      // TrustLedger Step 6: Set the preview modal content
      setModalTemplate({
        ...template,
        htmlContent: fullContent,
        url: fullContent,
      });

      setModalView("preview");
      setMessage(` Retrieved ${template.certificateName}`);
    } catch (err: any) {
      console.error(" Error fetching template:", err);
      setMessage(`Failed: ${err.message || "Unknown error"}`);
    }
  };

  // --- End Function ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-700 drop-shadow-sm">
            Certificate Templates
          </h1>
          <p className="text-gray-600 mt-2">
            Manage and preview certificate templates for{" "}
            <span className="font-semibold text-indigo-600">
              {collegeDetails?.shortName || mockID}
            </span>
          </p>
          <p className="text-xs font-mono text-gray-400 mt-1">
            College ID: {mockID}
          </p>
        </header>

        {/* Message Bar */}
        {message && (
          <div className="bg-indigo-100 border border-indigo-400 text-indigo-700 px-4 py-3 rounded-xl mb-6 text-sm text-center shadow-sm animate-fade-in">
            {message}
          </div>
        )}

        {/* Upload Button */}
        <div className="flex justify-center mb-10">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 
          text-white font-semibold rounded-xl px-8 py-3 shadow-md hover:shadow-xl 
          transition-all duration-300 transform hover:scale-105"
          >
             Upload New Template
          </button>
        </div>

        {/* Template Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            <p className="text-center col-span-full text-gray-500 animate-pulse">
              Loading templates...
            </p>
          ) : templates.length === 0 ? (
            <p className="text-center col-span-full text-gray-500">
              No templates yet. Upload one!
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.templateId}
                className="bg-white/80 backdrop-blur-md border border-indigo-100 rounded-2xl p-6 shadow-sm 
              hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <h2 className="font-semibold text-lg text-gray-900 mb-1 group-hover:text-indigo-700 transition">
                    {t.certificateName}
                  </h2>
                  <p className="text-sm text-gray-500">Type: {t.type}</p>
                  <p className="text-xs text-gray-400">
                    Chunks: {t.chunkCount}
                  </p>
                </div>
                <button
                  onClick={() => fetchTemplateContent(t)}
                  className="mt-5 text-indigo-600 font-medium hover:underline transition"
                >
                  View Certificate →
                </button>
              </div>
            ))
          )}
        </section>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative animate-fade-in-up">
              <button
                onClick={() => setShowUploadModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-indigo-600 text-xl"
              >
                ✕
              </button>

              <h2 className="text-2xl font-bold mb-5 text-indigo-700 text-center">
                Upload New Template
              </h2>

              <input
                type="text"
                placeholder="Certificate Name"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 mb-4 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <h3 className="text-gray-700 font-medium mb-2">
                Certificate Type
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {["Degree", "Certificate"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`py-2 px-3 rounded-lg font-medium text-sm border transition-all ${
                      type === t
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <input
                  type="file"
                  accept=".html"
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
                    ? ` File ready: ${file.name} (${(
                        file.size /
                        1024 /
                        1024
                      ).toFixed(2)} MB)`
                    : "Drag & Drop or Click to Upload (.html file)"}
                </div>
              </div>

              <button
                onClick={uploadTemplate}
                disabled={!rawFileContent || uploading || !certificateName}
                className="w-full py-2.5 rounded-lg font-semibold text-white 
              bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 
              transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Template"}
              </button>
            </div>
          </div>
        )}

        {/* View Modal */}
        {modalTemplate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full p-6 relative animate-fade-in-up">
              <button
                onClick={() => setModalTemplate(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-indigo-600 text-2xl"
              >
                ✕
              </button>

              <h2 className="text-2xl font-semibold mb-4 text-indigo-700">
                {modalTemplate.certificateName}
              </h2>

              {/* Tab Controls */}
              <div className="flex border-b border-gray-200 mb-4">
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

              <div className="h-[70vh] rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                {modalView === "preview" ? (
                  <iframe
                    srcDoc={modalTemplate.url}
                    title={modalTemplate.name}
                    className="w-full h-full rounded-lg border-none"
                  />
                ) : (
                  <textarea
                    readOnly
                    value={modalTemplate.htmlContent}
                    className="w-full h-full p-4 font-mono text-xs text-gray-800 bg-gray-50 border-none focus:outline-none"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
