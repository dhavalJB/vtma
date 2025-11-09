"use client";
import React, { useState, useEffect } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

  const handleSecureDownload = async () => {
    try {
      if (!result?.pdfUrl) {
        alert("No verified PDF found to download.");
        return;
      }

      console.log("🔒 [Verifier] Secure downloading verified PDF...");

      // 1️⃣ Fetch the original verified PDF
      const pdfBytes = await fetch(result.pdfUrl).then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // 2️⃣ Embed VishwasPatra verification metadata
      const compositeHash = result.compositeHash || "unknown";
      pdfDoc.setTitle("VishwasPatra Verified Certificate");
      pdfDoc.setAuthor(result.collegeName || "VishwasPatra");
      pdfDoc.setSubject("Blockchain Authenticated Certificate");
      pdfDoc.setProducer("VishwasPatra DApp");
      pdfDoc.setCreator("Meta Realm | TON + IPFS");
      pdfDoc.setKeywords([
        JSON.stringify({
          compositeHash,
          verifiedBy: "VishwasPatra",
          version: "v1",
        }),
      ]);

      // 3️⃣ Add verification QR (for easy re-verification)
      const verifyUrl = `http://localhost:5173/verifier?verify-hash=${compositeHash}`;
      const qrDataUrl = await import("qrcode").then((q) =>
        q.default.toDataURL(verifyUrl, { margin: 1, width: 100 })
      );
      const qrImage = await pdfDoc.embedPng(qrDataUrl);

      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width } = lastPage.getSize();
      const qrSize = 90;
      const margin = 40;

      lastPage.drawImage(qrImage, {
        x: width - qrSize - margin,
        y: margin,
        width: qrSize,
        height: qrSize,
      });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      lastPage.drawText("Verify at VishwasPatra", {
        x: width - qrSize - margin - 10,
        y: margin - 10,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      // 4️⃣ Save and trigger secure download
      const updatedBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(updatedBytes)], {
        type: "application/pdf",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${result.collegeRegId || "Verified"}_Certificate.pdf`;
      link.click();

      console.log("✅ [Verifier] Secure verified PDF downloaded.");
    } catch (err) {
      console.error("❌ [Verifier] Secure download failed:", err);
      alert("Failed to securely download the verified certificate.");
    }
  };

  // ✅ UI Rendering
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="w-full bg-white shadow-sm py-3 px-4 flex justify-between items-center border-b border-indigo-100">
        <h1 className="text-lg font-bold text-indigo-700">VishwasPatra</h1>
        <span className="text-[11px] text-gray-500 font-medium">
          Secure Verification
        </span>
      </header>

      {/* Main Section */}
      <main className="flex-1 flex flex-col justify-start items-center text-center px-3 py-5">
        <div className="bg-white shadow-md rounded-2xl p-5 w-full border border-gray-100">
          {!result ? (
            <>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Verify Your Certificate
              </h2>
              <p className="text-xs text-gray-500 mb-5">
                Upload a PDF or open via link to check authenticity.
              </p>

              {/* Upload Field */}
              <label
                htmlFor="pdf-upload"
                className="block cursor-pointer border-2 border-dashed border-indigo-400 rounded-xl py-8 flex flex-col items-center justify-center text-gray-500 hover:bg-indigo-50 transition"
              >
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-2">
                  <div className="text-3xl">📄</div>
                  {fileName ? (
                    <span className="font-medium text-indigo-700 text-xs break-all">
                      {fileName}
                    </span>
                  ) : (
                    <span className="text-sm font-medium">
                      Tap to Upload PDF
                    </span>
                  )}
                </div>
              </label>

              {/* Instant PDF Preview */}
              {file && (
                <div className="mt-4">
                  <h3 className="text-xs font-medium text-gray-700 mb-1 text-left">
                    Preview:
                  </h3>
                  <div className="w-full h-[320px] border rounded-xl overflow-hidden shadow-sm bg-gray-50">
                    <embed
                      src={URL.createObjectURL(file)}
                      type="application/pdf"
                      className="w-full h-full rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 text-center">
                    This is a temporary preview — verification will start once
                    you press <b>“Verify Now”</b>.
                  </p>
                </div>
              )}

              {/* Verify Button */}
              {file && (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition ${
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
            <div className="text-left space-y-3">
              {/* College Branding */}
              <div className="flex flex-col items-center">
                {result.logoImage && (
                  <img
                    src={result.logoImage}
                    alt={result.collegeName}
                    className="w-20 h-20 rounded-full mb-3 border border-indigo-200 shadow-sm"
                  />
                )}
                <h2
                  className={`text-lg font-bold ${
                    result.verified ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {result.status}
                </h2>
                <p className="text-xs text-gray-600 text-center">
                  {result.message}
                </p>
              </div>

              {/* Certificate Details */}
              <div className="border-t border-gray-200 pt-3 space-y-1 text-xs text-gray-700">
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
                  <strong>Issued:</strong>{" "}
                  {new Date(result.issuedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Certificate Preview */}
              {result.pdfUrl && (
                <div className="mt-3 relative">
                  <h3 className="text-xs font-medium text-gray-700 mb-1">
                    Certificate Preview:
                  </h3>
                  <div className="relative w-full h-[320px] border rounded-xl overflow-hidden shadow-inner">
                    <iframe
                      src={`${result.pdfUrl}#view=FitH`}
                      className="w-full h-full rounded-lg"
                      title="Verified Certificate"
                    ></iframe>

                    {/* 🛡️ Secure Download Overlay */}
                    <button
                      onClick={handleSecureDownload}
                      className="absolute top-2 right-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md"
                    >
                      ⬇️ Secure Download
                    </button>
                  </div>

                  {/* Open Full PDF */}
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center text-xs bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 transition"
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
                className="mt-3 w-full py-2 text-xs font-medium border border-gray-300 rounded-xl hover:bg-gray-100 text-gray-700"
              >
                Verify Another
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-3 text-center text-[11px] text-gray-500 border-t bg-white">
        <p>
          Powered by{" "}
          <span className="font-semibold text-indigo-600">VishwasPatra</span> |
          TON Network
        </p>
      </footer>
    </div>
  );
}
