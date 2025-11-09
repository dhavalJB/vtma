import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../../App";
import { db } from "../../../firebaseConfig";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { Search, Building2, Download, FileText } from "lucide-react";
import { fetchTemplateContentFromFirestore } from "../../../utils/firestoreTemplateUtils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto-js";
import QRCode from "qrcode";

interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  status: string;
  year: number;
  day: number;
  month: number;
  faculty: string;
  courseName: string;
  walletId: string;
}

export default function StudentRegistrar() {
  const location = useLocation();
  const { session } = useSession();
  const mockID = location.state?.mockID || session?.mockID;

  const [students, setStudents] = useState<Student[]>([]);
  const [collegeDetails, setCollegeDetails] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [sortField, setSortField] = useState<keyof Student | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certType, setCertType] = useState<"degree" | "certificate" | null>(
    null
  );
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewHTML, setPreviewHTML] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<{
    id: string;
    fileURL: string;
    title: string;
  } | null>(null);

  // Fetch college + students
  useEffect(() => {
    if (!mockID) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // College details
        const collegeSnap = await getDoc(doc(db, "colleges", mockID));
        if (collegeSnap.exists()) {
          const data = collegeSnap.data();

          // Ensure logo URL is easy to access
          const logoURL = data?.logo?.[0]?.normalImage || ""; // fallback if missing
          const logoContractAddress = data?.logo?.[0]?.contractAddress || "";
          console.log("College Logo URL:", logoURL); // <--- log here

          setCollegeDetails({
            ...data,
            logoURL, // add a direct field for template usage
            logoContractAddress,
          });
        }

        // Students
        const studentsCol = collection(db, "colleges", mockID, "students");
        const studentSnapshots = await getDocs(studentsCol);
        const studentList: Student[] = studentSnapshots.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Student, "id">),
        }));
        setStudents(studentList);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mockID]);

  useEffect(() => {
    if (!showCertModal || !mockID) return;

    const fetchTemplates = async () => {
      try {
        const collegeSnap = await getDoc(doc(db, "colleges", mockID));
        if (collegeSnap.exists()) {
          const collegeData = collegeSnap.data();
          setTemplates(collegeData?.templates || []);
        } else {
          setTemplates([]);
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
      }
    };

    fetchTemplates();
  }, [showCertModal, mockID]);

  // Apply search, filters, and sorting
  const filteredStudents = useMemo(() => {
    let data = students;

    if (search)
      data = data.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()) ||
          s.program.toLowerCase().includes(search.toLowerCase())
      );
    if (statusFilter) data = data.filter((s) => s.status === statusFilter);
    if (programFilter) data = data.filter((s) => s.program === programFilter);
    if (yearFilter) data = data.filter((s) => s.year === yearFilter);

    if (sortField)
      data = [...data].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === "string") {
          return sortDir === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal);
        }
        if (typeof aVal === "number") {
          return sortDir === "asc"
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        }
        return 0;
      });

    return data;
  }, [
    students,
    search,
    statusFilter,
    programFilter,
    yearFilter,
    sortField,
    sortDir,
  ]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-gray-500 text-lg">
        Loading students...
      </div>
    );

  const exportCSV = () => {
    const csv = [
      ["Name", "Email", "Program", "Status", "Year"],
      ...students.map((s) => [s.name, s.email, s.program, s.status, s.year]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collegeDetails.name || "students"}-list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewCertificates = async (student: Student) => {
    try {
      console.log("🟢 Opening certificates for:", student.name, student.id);

      const certRef = collection(
        db,
        "colleges",
        mockID,
        "students",
        student.id,
        "certificates"
      );
      const certSnap = await getDocs(certRef);

      console.log("📜 certSnap size:", certSnap.size);

      if (certSnap.empty) {
        alert(`No certificates found for ${student.name}`);
        return;
      }

      const certList = certSnap.docs.map((doc, index) => ({
        id: doc.id,
        title: `Certificate - ${index + 1}`,
        fileURL: doc.data().pdfUrl || doc.data().fileURL || "",
      }));

      console.log("✅ Certificates found:", certList);

      setCertificates(certList);
      setSelectedStudent(student);
      setShowModal(true);
    } catch (err) {
      console.error("Error fetching certificates:", err);
      alert("Failed to fetch certificate details.");
    }
  };

  const handleDownloadCertificate = async (
    studentId: string,
    certId: string
  ) => {
    try {
      // 1️⃣ Fetch certificate document
      const certDocRef = doc(
        db,
        "colleges",
        mockID,
        "students",
        studentId,
        "certificates",
        certId
      );
      const certSnap = await getDoc(certDocRef);
      if (!certSnap.exists()) {
        alert("Certificate data not found!");
        return;
      }
      const certData = certSnap.data();

      // 2️⃣ Prepare fields for hashing (canonical core)
      const fields = {
        collegeContractAddress: certData.collegeContractAddress,
        studentContractAddress: certData.studentContractAddress,
        collegeId: mockID,
        collegeFullName: certData.collegeDetails?.fullName,
        collegeShortName: certData.collegeDetails?.shortName,
        collegeRegId: certData.collegeDetails?.regId,
        studentId: studentId,
        templateId: certData.templateId,
        pdfIpfs: certData.pdfIpfs,
        metaUri: certData.metaUri,
        mintedAt: certData.mintedAt,
      };

      // 3️⃣ Create canonical string and hash
      const canonical = JSON.stringify(
        Object.keys(fields)
          .sort()
          .reduce((obj: Record<string, any>, key) => {
            obj[key] = (fields as Record<string, any>)[key];
            return obj;
          }, {})
      );

      const compositeHash = crypto
        .SHA256("VISHWASPATRA:v1|" + canonical)
        .toString();

      console.log("🧩 Composite Hash:", compositeHash);

      // 4️⃣ Check and insert into composite registry
      const registryRef = doc(db, "compositeRegistry", compositeHash);
      const registrySnap = await getDoc(registryRef);

      if (!registrySnap.exists()) {
        const registryEntry = {
          collegeId: mockID,
          studentId: studentId,
          certificateId: certId,
          hash: compositeHash,
          createdAt: new Date().toISOString(),
        };

        await setDoc(registryRef, registryEntry);
        console.log("✅ Added to composite registry:", compositeHash);
      }

      // 5️⃣ Fetch original PDF
      const pdfBytes = await fetch(certData.pdfUrl).then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // 6️⃣ Add VishwasPatra metadata
      pdfDoc.setTitle("Blockchain Verified Certificate");
      pdfDoc.setAuthor(certData.collegeDetails?.fullName || "VishwasPatra");
      pdfDoc.setSubject("VishwasPatra Authentic Certificate");
      pdfDoc.setProducer("VishwasPatra DApp");
      pdfDoc.setCreator("Meta Realm | TON + IPFS");
      pdfDoc.setKeywords([
        JSON.stringify({
          compositeHash,
          version: "v1",
        }),
      ]);

      // 7️⃣ Generate QR code for verification link
      const verifyUrl = `http://localhost:5173/verifier?verify-hash=${compositeHash}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 100,
      });
      const qrImage = await pdfDoc.embedPng(qrDataUrl);

      // 8️⃣ Add QR code + text on last page
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();

      const qrSize = 90;
      const margin = 40;

      lastPage.drawImage(qrImage, {
        x: width - qrSize - margin,
        y: margin,
        width: qrSize,
        height: qrSize,
      });

      // Add "Verify this document" text under QR
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      lastPage.drawText("Verify at VishwasPatra", {
        x: width - qrSize - margin - 10,
        y: margin - 10,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      // 9️⃣ Save & download updated PDF
      const updatedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(updatedPdfBytes)], {
        type: "application/pdf",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${
        certData.collegeDetails?.shortName || "Certificate"
      }_${studentId}.pdf`;
      link.click();

      console.log("✅ Certificate downloaded with embedded QR code and hash.");
    } catch (err) {
      console.error("❌ Error during certificate generation:", err);
      alert("Failed to generate secure certificate with QR.");
    }
  };

  const handleTemplateSelect = async (template: any) => {
    if (!selectedStudent) return; // Ensure student is selected

    try {
      setLoadingPreview(true);
      setSelectedTemplate(template);

      const fullHTML = await fetchTemplateContentFromFirestore(template);

      // Use let so we can reassign
      let personalizedHTML = fullHTML
        .replace(/{{Student Name}}/g, selectedStudent.name)
        .replace(
          /{{Degree Number}}/g,
          Math.floor(100000 + Math.random() * 900000).toString()
        )
        .replace(
          /{{Faculty Name}}/g,
          selectedStudent.faculty || "Faculty of Science"
        )
        .replace(/{{Course Name}}/g, selectedStudent.courseName || "")
        .replace(/{{Day}}/g, new Date().getDate().toString())
        .replace(
          /{{Month}}/g,
          new Date().toLocaleString("default", { month: "long" })
        )
        .replace(/{{Year}}/g, new Date().getFullYear().toString())
        // College Logo URL
        .replace(/{{CollegeLogoURL}}/g, collegeDetails.logoURL || "");

      // Make logo clickable
      const nftLink = `https://testnet.tonviewer.com/${collegeDetails.logoContractAddress}?section=nft`;
      personalizedHTML = personalizedHTML.replace(
        /<img class="logo" src="(.*?)"\s*\/?>/,
        `<a href="${nftLink}" target="_blank"><img class="logo" src="$1" /></a>`
      );

      setPreviewHTML(personalizedHTML);
    } catch (err) {
      console.error("Error loading template:", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendCertificate = async () => {
    if (!selectedStudent || !selectedTemplate || !previewHTML) return;

    const payload = {
      studentWallet: selectedStudent.walletId,
      collegeWallet: collegeDetails.walletId,
      studentId: selectedStudent.id,
      collegeId: mockID,
      templateId: selectedTemplate.templateId,
      collegeDetails: {
        regId: collegeDetails.regId,
        fullName: collegeDetails.name,
        shortName: collegeDetails.shortName,
      },
      html: previewHTML,
    };

    console.log("Payload to send:", payload); // log before sending

    try {
      // FIX: Corrected URL from "/api/api/student-gen-mint" to "/api/student-gen-mint"
      const res = await fetch("http://localhost:5000/api/student-gen-mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }); // The rest of your logic remains the same

      const data = await res.json();
      if (res.ok) {
        alert("Certificate payload sent successfully!");
      } else {
        alert(`Error: ${data.error || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("Error sending payload:", err);
      alert(
        "Failed to send certificate payload. Check server logs for details."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-blue-50 font-sans p-4">
      {/* Header */}
      <header className="bg-white shadow-md rounded-2xl p-4 mb-5 flex items-center gap-3 sticky top-0 z-20">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-400 flex items-center justify-center shadow">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 leading-tight">
            {collegeDetails.name || "Institution"}
          </h1>
          <p className="text-xs text-gray-500 truncate">
            {collegeDetails.address || "Manage Students & Certificates"}
          </p>
        </div>
      </header>

      {/* Filters (Collapsible on Mobile) */}
      <div className="bg-white shadow-sm rounded-2xl p-4 border border-gray-100 mb-5">
        <div className="relative mb-3">
          <Search className="absolute top-2.5 left-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border border-gray-300 rounded-xl p-2 text-sm text-gray-700"
            value={statusFilter ?? ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="border border-gray-300 rounded-xl p-2 text-sm text-gray-700"
            value={programFilter ?? ""}
            onChange={(e) => setProgramFilter(e.target.value || null)}
          >
            <option value="">Programs</option>
            {[...new Set(students.map((s) => s.program))].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-xl p-2 text-sm text-gray-700 col-span-2"
            value={yearFilter ?? ""}
            onChange={(e) =>
              setYearFilter(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All Years</option>
            {[...new Set(students.map((s) => s.year))].sort().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List (Card View) */}
      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">
            No students found.
          </div>
        ) : (
          filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white shadow-sm rounded-2xl p-4 border border-gray-100 transition hover:shadow-md"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-base font-semibold text-gray-800">
                  {s.name}
                </h2>
                <span
                  className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    s.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {s.status.toUpperCase()}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-1">{s.email}</p>
              <p className="text-sm text-gray-700 mb-2">
                🎓 {s.program} — {s.year}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleViewCertificates(s)}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  View
                </button>
                <button
                  onClick={() => {
                    setSelectedStudent(s);
                    setShowCertModal(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                >
                  Issue
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Certificate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-indigo-700 mb-3">
              Certificates — {selectedStudent?.name}
            </h2>
            {selectedCertificate ? (
              // If user clicked "View" — show PDF preview
              <div className="flex flex-col items-center relative">
                {/* PDF Preview */}
                <div className="w-full h-[65vh] border rounded-xl overflow-hidden mb-4 shadow-inner relative">
                  <iframe
                    src={selectedCertificate.fileURL}
                    title="Certificate PDF Preview"
                    className="w-full h-full rounded-lg border-0"
                  />
                  {/* Secure Download Overlay Button */}
                  <button
                    onClick={() =>
                      selectedStudent &&
                      handleDownloadCertificate(
                        selectedStudent.id,
                        selectedCertificate.id
                      )
                    }
                    className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-md transition"
                  >
                    ⬇️ Secure Download
                  </button>
                </div>

                {/* Back Button */}
                <button
                  onClick={() => setSelectedCertificate(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition"
                >
                  ← Back to Certificates
                </button>
              </div>
            ) : (
              // Default — show certificate list
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {certificates.map((c) => (
                  <div
                    key={c.id}
                    className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between items-center"
                  >
                    <span className="truncate">{c.title}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedCertificate(c)}
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() =>
                          selectedStudent &&
                          handleDownloadCertificate(selectedStudent.id, c.id)
                        }
                        className="text-green-600 hover:underline text-xs"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Certificate Generator Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl overflow-y-auto max-h-[85vh]">
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-indigo-600 text-xl"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-indigo-700 mb-4">
              Generate Certificate
            </h2>

            <div className="flex gap-2 mb-3">
              {["degree", "certificate"].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setCertType(type as "degree" | "certificate");
                    setSelectedTemplate(null);
                    setPreviewHTML("");
                  }}
                  className={`px-3 py-2 text-xs rounded-lg border ${
                    certType === type
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-100 text-gray-700 border-gray-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {certType && (
              <div className="grid grid-cols-1 gap-2 mb-4">
                {templates
                  .filter((t) => t.type.toLowerCase() === certType)
                  .map((t) => (
                    <button
                      key={t.templateId}
                      onClick={() => handleTemplateSelect(t)}
                      className={`p-2 border rounded-lg text-left text-sm ${
                        selectedTemplate?.templateId === t.templateId
                          ? "border-indigo-600 bg-indigo-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {t.certificateName || t.name}
                    </button>
                  ))}
              </div>
            )}

            {loadingPreview ? (
              <p className="text-center text-gray-500 text-sm py-5">
                Loading preview...
              </p>
            ) : previewHTML ? (
              <iframe
                srcDoc={previewHTML}
                title="Certificate Preview"
                className="w-full h-[50vh] border rounded-xl"
              />
            ) : (
              <p className="text-sm text-gray-400 text-center py-5">
                Select a template to see preview.
              </p>
            )}

            <button
              onClick={sendCertificate}
              disabled={!previewHTML}
              className="mt-4 w-full py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              🚀 Generate & Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
