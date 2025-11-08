"use client";
import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function Verifier() {
  const [fileName, setFileName] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const meta = {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        keywords: pdfDoc.getKeywords(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        creationDate: pdfDoc.getCreationDate(),
      };
      console.log("📄 PDF Metadata:", meta);
    } catch (err) {
      console.error("❌ Failed to read PDF metadata:", err);
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

      {/* Main Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-4">
        <div className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Verify Your Certificate
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload your blockchain-issued document to inspect metadata.
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

          <p className="mt-4 text-xs text-gray-400">
            Only .pdf files are supported
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
