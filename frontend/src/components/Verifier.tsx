"use client";
import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";

export default function Verifier() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  // ✅ Unified verification (handles hash or file)
  const handleVerify = async (
    arg?: string | React.MouseEvent<HTMLButtonElement>
  ) => {
    setVerifying(true);
    try {
      let response;

      if (typeof arg === "string") {
        console.log("🚀 [Frontend] Starting verification with hash:", arg);

        const formData = new FormData();
        formData.append("hash", arg);

        response = await fetch("http://localhost:5000/verify/verify-pdf", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!file) {
          alert("Please upload a PDF first!");
          setVerifying(false);
          return;
        }

        console.log(
          "📤 [Frontend] Uploading file for verification:",
          file.name
        );
        const formData = new FormData();
        formData.append("file", file, file.name);

        response = await fetch("http://localhost:5000/verify/verify-pdf", {
          method: "POST",
          body: formData,
        });
      }

      const data = await response.json();
      console.log("📡 [Frontend] Backend Response:", data);
      setResult(data);
    } catch (err) {
      console.error("❌ [Frontend] Verification Error:", err);
      alert("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  // ✅ Auto-check for hash in URL (runs once)
  useEffect(() => {
    const url = window.location.href;
    console.log("🌐 Current URL:", url);

    // ✅ Support both ?hash= and ?verify-hash=
    const match = url.match(/[?&](?:verify-hash|hash)=([a-f0-9]+)/i);
    if (match && match[1]) {
      const hash = match[1];
      console.log("🔍 [Frontend] Auto-verifying using hash from URL:", hash);
      handleVerify(hash);
    } else {
      console.log(
        "ℹ️ [Frontend] No hash found in URL — waiting for manual upload."
      );
    }
  }, []);

  // ✅ Handles user file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setResult(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const keywords = pdfDoc.getKeywords();
      let compositeHash = "—";

      if (keywords && typeof keywords === "string") {
        try {
          const parsed = JSON.parse(keywords);
          compositeHash = parsed.compositeHash || "—";
        } catch {
          console.warn("⚠️ Could not parse keywords JSON from PDF metadata.");
        }
      }

      console.log(
        "📄 [Frontend] Extracted Composite Hash from PDF:",
        compositeHash
      );
    } catch (err) {
      console.error("❌ [Frontend] Failed to process uploaded PDF:", err);
    }
  };

  // ✅ UI Rendering
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

      {/* Main Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-4">
        <div className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md border border-gray-200">
          {!result ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Verify Your Certificate
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Upload or open via verification link to check authenticity.
              </p>

              {/* Upload Field */}
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

              {/* Instant PDF Preview */}
              {file && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Preview:
                  </h3>
                  <div className="w-full h-[400px] border rounded-xl overflow-hidden shadow-sm">
                    <iframe
                      src={URL.createObjectURL(file)}
                      className="w-full h-full"
                      title="Certificate Preview"
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Verify Button */}
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
            </>
          ) : (
            // ✅ Verified Certificate Card
            <div className="text-left space-y-4">
              {/* College Branding */}
              <div className="flex flex-col items-center">
                {result.logoImage && (
                  <img
                    src={result.logoImage}
                    alt={result.collegeName}
                    className="w-24 h-24 rounded-full mb-4 border-2 border-indigo-200 shadow-md"
                  />
                )}
                <h2
                  className={`text-2xl font-bold ${
                    result.verified ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {result.status}
                </h2>
                <p className="text-gray-600 text-sm text-center">
                  {result.message}
                </p>
              </div>

              {/* Certificate Details */}
              <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                <p>
                  <strong>Institution:</strong> {result.collegeName} (
                  {result.collegeRegId})
                </p>
                <p>
                  <strong>Certificate ID:</strong> {result.certificateId}
                </p>
                <p>
                  <strong>Student ID:</strong> {result.studentId}
                </p>
                <p>
                  <strong>Issued On:</strong>{" "}
                  {new Date(result.issuedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Blockchain Address */}
              {result.studentContractAddress && (
                <div className="mt-3">
                  <p className="text-sm text-gray-700">
                    <strong>On-Chain Contract:</strong>{" "}
                    <a
                      href={`https://testnet.tonviewer.com/${result.studentContractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      🔗 View on TON Chain
                    </a>
                  </p>
                </div>
              )}

              {/* Visible Embedded PDF */}
              {result.pdfUrl && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Certificate Preview:
                  </h3>
                  <div className="w-full h-[400px] border rounded-xl overflow-hidden shadow-sm">
                    <iframe
                      src={`${result.pdfUrl}#view=FitH`}
                      className="w-full h-full"
                      title="Verified Certificate"
                    ></iframe>
                  </div>
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 transition"
                  >
                    Open Full PDF
                  </a>
                </div>
              )}

              {/* Verify Another */}
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setFileName("");
                }}
                className="mt-3 w-full py-2 rounded-xl text-sm font-medium border border-gray-300 hover:bg-gray-100 transition"
              >
                Verify Another
              </button>
            </div>
          )}
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
