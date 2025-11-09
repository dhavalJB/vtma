"use client";
import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function Verifier() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // Step 1️⃣: Upload and parse locally
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setVerified(false);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

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

      const extracted = {
        title,
        author,
        subject,
        compositeHash,
        version,
      };

      setMeta(extracted);

      console.log(
        `Title: ${title || "—"} | Issuer: ${author || "—"} | Subject: ${
          subject || "—"
        } | Composite Hash: ${compositeHash} | Version: ${version}`
      );
    } catch (err) {
      console.error("❌ Failed to process PDF:", err);
    }
  };

  // Step 2️⃣: Backend Verification
  const handleVerify = async () => {
    if (!file) return alert("Please upload a PDF first!");
    setVerifying(true);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch("http://localhost:5000/verify/verify-pdf", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("📡 Backend Response:", result);

      if (response.ok) {
        setVerified(true);
      } else {
        alert(result.error || "Verification failed.");
      }
    } catch (err) {
      console.error("❌ Verification error:", err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="w-full bg-white shadow-md py-4 px-6 flex justify-between items-center">
        <h1 className="text-lg md:text-2xl font-bold text-indigo-700">
          VishwasPatra
        </h1>
        <span className="text-xs md:text-sm text-gray-500 font-medium">
          Secure Document Verification
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-4">
        <div className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Verify Your Certificate
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload your blockchain-issued certificate to begin verification.
          </p>

          <label
            htmlFor="pdf-upload"
            className="block cursor-pointer border-2 border-dashed border-indigo-400 rounded-2xl py-10 flex flex-col items-center justify-center text-gray-500 hover:bg-indigo-50 transition duration-300 ease-in-out"
          >
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex flex-col items-center space-y-2">
              <div className="text-4xl">📄</div>
              {fileName ? (
                <span className="font-medium text-indigo-700 break-all text-sm">
                  {fileName}
                </span>
              ) : (
                <span className="text-sm md:text-base font-medium">
                  Tap to Upload PDF
                </span>
              )}
            </div>
          </label>

          {file && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`mt-6 w-full py-3 rounded-xl font-semibold transition ${
                verifying
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {verifying ? "Verifying..." : "Verify Now"}
            </button>
          )}

          {verified && (
            <p className="mt-4 text-green-600 font-semibold">
              ✅ Verified Successfully
            </p>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Logs visible in browser and backend console
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-gray-500 border-t bg-white">
        <p>
          Powered by{" "}
          <span className="font-semibold text-indigo-600">VishwasPatra</span> |
          Built on TON Network
        </p>
      </footer>
    </div>
  );
}
