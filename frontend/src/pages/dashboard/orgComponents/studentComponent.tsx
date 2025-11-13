import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../../App";
import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { Search, Building2, Download, FileText, Plus } from "lucide-react";
import { fetchTemplateContentFromFirestore } from "../../../utils/firestoreTemplateUtils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto-js";
import QRCode from "qrcode";

// ---------- Student type ----------
interface Student {
  id: string; // doc id
  studentId: string; // same as id (for clarity)
  name: string;
  email: string;
  program: string;
  status: string;
  year: number;
  day?: number;
  month?: number;
  faculty?: string;
  courseName?: string;
  walletId?: string;
}

type CsvRow = {
  studentId?: string;
  name?: string;
  email?: string;
  program?: string;
  status?: string;
  year?: string;
  faculty?: string;
  courseName?: string;
  walletId?: string;
  _line?: number;
};

type RowDecision = "skip" | "overwrite" | "add" | "ask";

// ---------- Component ----------
export default function StudentRegistrar() {
  const location = useLocation();
  const { session } = useSession();
  const mockID = location.state?.mockID || session?.mockID;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
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
  const FrontendURL = import.meta.env.VITE_FRONTEND_URL;
  const [sending, setSending] = useState(false);

  // ---------- NEW: UI states for add student & CSV ----------
  const [showAddModal, setShowAddModal] = useState(false);
  const [singleForm, setSingleForm] = useState<Partial<Student>>({});
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvInvalidCount, setCsvInvalidCount] = useState(0);
  const [csvDuplicateCount, setCsvDuplicateCount] = useState(0);
  // duplicate handling: "ask" | "overwrite_all" | "skip_all"
  const [duplicateMode, setDuplicateMode] = useState<
    "ask" | "overwrite_all" | "skip_all"
  >("ask");
  // when in ask mode we keep per-row decision
  const [perRowDecision, setPerRowDecision] = useState<
    Record<number, RowDecision>
  >({});

  // ---------- Fetch college + students (existing) ----------
  useEffect(() => {
    if (!mockID) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // -----------------------------------------
        // 🔵 1. Fetch College Details
        // -----------------------------------------
        const collegeSnap = await getDoc(doc(db, "colleges", mockID));
        if (collegeSnap.exists()) {
          const data = collegeSnap.data();

          // Extract logoURL + contractAddress
          let logoURL = "";
          let logoContractAddress = "";

          if (data.logo && Array.isArray(data.logo)) {
            // Try logo[0]
            if (data.logo[0]?.normalImage) {
              logoURL = data.logo[0].normalImage;
              logoContractAddress = data.logo[0].contractAddress || "";
            }
            // Try logo[1]
            else if (data.logo[1]?.normalImage) {
              logoURL = data.logo[1].normalImage;
              logoContractAddress = data.logo[1].contractAddress || "";
            }
          }

          setCollegeDetails({
            ...data,
            logoURL,
            logoContractAddress,
          });
        }

        // -----------------------------------------
        // 🔵 2. Fetch Students
        // -----------------------------------------
        const studentsCol = collection(db, "colleges", mockID, "students");
        const studentSnapshots = await getDocs(studentsCol);

        const studentList: Student[] = studentSnapshots.docs.map((d) => {
          const dd: any = d.data();
          return {
            id: d.id,
            studentId: dd.studentId || d.id,
            name: dd.name || "",
            email: dd.email || "",
            program: dd.program || "",
            status: dd.status || "active" || "Active",
            year: dd.year ? Number(dd.year) : new Date().getFullYear(),
            faculty: dd.faculty || "",
            courseName: dd.courseName || "",
            walletId: dd.walletId || "",
            day: dd.day,
            month: dd.month,
          } as Student;
        });

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

  // ---------- Filters + sorting ----------
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

  // ---------- Helpers ----------
  const resetAddForm = () => {
    setSingleForm({});
    setCsvFileName(null);
    setCsvRows([]);
    setCsvPreviewOpen(false);
    setCsvInvalidCount(0);
    setCsvDuplicateCount(0);
    setDuplicateMode("ask");
    setPerRowDecision({});
  };

  const validateCsvRow = (r: CsvRow) => {
    // required columns: studentId,name,email,program,status,year (year can be numeric)
    if (
      !r.studentId ||
      !r.name ||
      !r.email ||
      !r.program ||
      !r.status ||
      !r.year
    )
      return false;
    // basic email check
    if (!/\S+@\S+\.\S+/.test(r.email)) return false;
    if (Number.isNaN(Number(r.year))) return false;
    return true;
  };

  // ---------- Single student add ----------
  const handleAddSingleStudent = async () => {
    if (!mockID) return alert("Missing college id");
    // per your choice 1A: studentId required
    if (!singleForm.studentId || singleForm.studentId.trim() === "") {
      return alert("studentId is required");
    }
    const sid = String(singleForm.studentId).trim();
    const docRef = doc(db, "colleges", mockID, "students", sid);
    try {
      // check exists
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const ok = confirm(
          `Student ${sid} already exists. Overwrite? (OK = overwrite, Cancel = abort)`
        );
        if (!ok) return;
      }

      const payload = {
        studentId: sid,
        id: sid,
        name: singleForm.name || "",
        email: singleForm.email || "",
        program: singleForm.program || "",
        status: singleForm.status || "active",
        year: singleForm.year
          ? Number(singleForm.year)
          : new Date().getFullYear(),
        faculty: singleForm.faculty || "",
        courseName: singleForm.courseName || "",
        walletId: singleForm.walletId || "",
      };

      await setDoc(docRef, payload);
      // refresh local list
      setStudents((prev) => [{ ...payload } as Student, ...prev]);
      resetAddForm();
      setShowAddModal(false);
      alert("Student added successfully");
    } catch (err) {
      console.error("Failed to add student:", err);
      alert("Failed to add student");
    }
  };

  // ---------- CSV parsing (no external deps) ----------
  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const rows = text.split(/\r?\n/).filter(Boolean);
      if (rows.length === 0) {
        alert("CSV is empty");
        return;
      }

      // first row header
      const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
      const required = [
        "studentid",
        "name",
        "email",
        "program",
        "status",
        "year",
      ];
      const missing = required.filter((r) => !header.includes(r));
      if (missing.length > 0) {
        alert(`CSV missing required columns: ${missing.join(", ")}`);
        return;
      }

      const parsed: CsvRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map((c) => c.trim());
        if (cols.length === 0) continue;
        const rowObj: CsvRow = { _line: i + 1 };
        header.forEach((h, idx) => {
          const key = h;
          (rowObj as any)[key] = cols[idx] !== undefined ? cols[idx] : "";
        });
        parsed.push(rowObj);
      }

      // validate and detect duplicates against existing students
      const existIds = new Set(students.map((s) => s.id));
      let invalid = 0;
      let dup = 0;
      parsed.forEach((r, idx) => {
        const valid = validateCsvRow(r);
        if (!valid) invalid++;
        if (r.studentId && existIds.has(String(r.studentId))) dup++;
        // initialize per-row decision to "add" for valid non-duplicate, else "ask"
        if (existIds.has(String(r.studentId))) {
          perRowDecision[idx] = "ask";
        } else {
          perRowDecision[idx] = "add";
        }
      });

      setCsvRows(parsed);
      setCsvInvalidCount(invalid);
      setCsvDuplicateCount(dup);
      setCsvPreviewOpen(true);
    };
    reader.readAsText(file);
  };

  // ---------- CSV Import action ----------
  const handleCsvImportConfirm = async () => {
    if (csvInvalidCount > 0) {
      const ok = confirm(
        `There are ${csvInvalidCount} invalid rows. Do you want to continue importing the valid rows?`
      );
      if (!ok) return;
    }

    if (!mockID) return alert("Missing college id");

    // decide global duplicate behavior
    let globalMode = duplicateMode; // "ask" | "overwrite_all" | "skip_all"

    // if ask mode, we will consult perRowDecision; if a per-row is still "ask", default to "skip"
    const batch = writeBatch(db);
    const ops: Array<Promise<void>> = [];

    // We'll perform row-by-row upserts (setDoc)
    for (let i = 0; i < csvRows.length; i++) {
      const r = csvRows[i];
      const line = r._line || i + 2;
      const valid = validateCsvRow(r);
      if (!valid) continue; // skip invalid rows

      const sid = String(r.studentId).trim();
      const docRef = doc(db, "colleges", mockID, "students", sid);

      // check existing
      // Note: to reduce reads, we can check local students list
      const existsLocally = students.find((s) => s.id === sid) !== undefined;

      if (existsLocally) {
        // decide based on global or per-row decision
        if (globalMode === "skip_all") {
          continue;
        } else if (globalMode === "overwrite_all") {
          const payload = {
            studentId: sid,
            id: sid,
            name: (r.name || "").trim(),
            email: (r.email || "").trim(),
            program: (r.program || "").trim(),
            status: (r.status || "active").trim(),
            year: Number(r.year),
            faculty: (r.faculty || "").trim(),
            courseName: (r.courseName || "").trim(),
            walletId: (r.walletId || "").trim(),
          };
          // push write
          ops.push(setDoc(docRef, payload).then(() => {}));
        } else {
          // ask mode
          const decision = perRowDecision[i];
          if (decision === "skip") {
            continue;
          } else if (decision === "overwrite") {
            const payload = {
              studentId: sid,
              id: sid,
              name: (r.name || "").trim(),
              email: (r.email || "").trim(),
              program: (r.program || "").trim(),
              status: (r.status || "active").trim(),
              year: Number(r.year),
              faculty: (r.faculty || "").trim(),
              courseName: (r.courseName || "").trim(),
              walletId: (r.walletId || "").trim(),
            };
            ops.push(setDoc(docRef, payload).then(() => {}));
          } else {
            // default skip
            continue;
          }
        }
      } else {
        // not exists -> create
        const payload = {
          studentId: sid,
          id: sid,
          name: (r.name || "").trim(),
          email: (r.email || "").trim(),
          program: (r.program || "").trim(),
          status: (r.status || "active").trim(),
          year: Number(r.year),
          faculty: (r.faculty || "").trim(),
          courseName: (r.courseName || "").trim(),
          walletId: (r.walletId || "").trim(),
        };
        ops.push(setDoc(docRef, payload).then(() => {}));
      }
    }

    // execute all ops sequentially (to keep simple error handling)
    try {
      for (const p of ops) {
        await p;
      }
      // Refresh students list: re-fetch
      const studentsCol = collection(db, "colleges", mockID, "students");
      const studentSnapshots = await getDocs(studentsCol);
      const studentList: Student[] = studentSnapshots.docs.map((d) => {
        const dd: any = d.data();
        return {
          id: d.id,
          studentId: dd.studentId || d.id,
          name: dd.name || "",
          email: dd.email || "",
          program: dd.program || "",
          status: dd.status || "active",
          year: dd.year ? Number(dd.year) : new Date().getFullYear(),
          faculty: dd.faculty || "",
          courseName: dd.courseName || "",
          walletId: dd.walletId || "",
        } as Student;
      });
      setStudents(studentList);
      alert("CSV import completed");
      resetAddForm();
    } catch (err) {
      console.error("CSV import error:", err);
      alert("CSV import failed. See console.");
    }
  };

  // ---------- UI handlers for per-row decision ----------
  const setDecisionForRow = (
    index: number,
    decision: "skip" | "overwrite" | "add"
  ) => {
    setPerRowDecision((prev) => ({ ...prev, [index]: decision }));
  };

  // ---------- The rest of your certificate code remains unchanged (copied from your previous file) ----------
  // For brevity I won't duplicate the entire certificate generation code here,
  // but the original functions (handleViewCertificates, handleDownloadCertificate,
  // handleTemplateSelect, sendCertificate) remain the same and continue to work.

  // For the sake of completeness, minimal stubs are provided if you rely on them in UI:
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
      const verifyUrl = `${FrontendURL}/verifier?verify-hash=${compositeHash}`;
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
    if (!selectedStudent || !selectedTemplate || !previewHTML || sending)
      return;

    setSending(true);

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

    console.log("Payload to send:", payload);

    try {
      const res = await fetch(`${backendUrl}/api/student-gen-mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Certificate Minted Successfully!");
      } else {
        alert(`Error: ${data.error || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("Error sending payload:", err);
      alert(
        "Failed to send certificate payload. Check server logs for details."
      );
    } finally {
      setSending(false);
    }
  };

  // ---------- Render ----------
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

      {/* Filters */}
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

      {/* Student List */}
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
                    s.status === "active" || s.status === "Active"
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

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        title="Add student"
        className="fixed right-6 bottom-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-xl flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add Student
      </button>

      {/* ---------- Add Modal ---------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Add Student</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="text-sm text-gray-500"
              >
                Close
              </button>
            </div>

            {/* Single add form */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input
                placeholder="studentId (required)"
                value={singleForm.studentId || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, studentId: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Name"
                value={singleForm.name || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, name: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Email"
                value={singleForm.email || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, email: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Program"
                value={singleForm.program || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, program: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Status (active/inactive)"
                value={singleForm.status || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, status: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Year"
                value={singleForm.year ? String(singleForm.year) : ""}
                onChange={(e) =>
                  setSingleForm({
                    ...singleForm,
                    year: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Faculty"
                value={singleForm.faculty || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, faculty: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Course Name"
                value={singleForm.courseName || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, courseName: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
              <input
                placeholder="Wallet ID"
                value={singleForm.walletId || ""}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, walletId: e.target.value })
                }
                className="border p-2 rounded-lg"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddSingleStudent}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
              >
                Add Student
              </button>

              {/* CSV upload */}
              <label className="bg-white border px-3 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2">
                <FileText className="w-4 h-4" /> Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>

              {csvFileName && (
                <span className="text-sm text-gray-500 self-center">
                  Loaded: {csvFileName}
                </span>
              )}
            </div>

            {/* CSV Preview controls */}
            {csvPreviewOpen && (
              <div className="mt-4 border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <strong>CSV Preview</strong>
                    <div className="text-xs text-gray-500">
                      Invalid rows: {csvInvalidCount} • Duplicates:{" "}
                      {csvDuplicateCount}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Duplicates:</label>
                    <select
                      value={duplicateMode}
                      onChange={(e) => setDuplicateMode(e.target.value as any)}
                      className="border rounded p-1 text-xs"
                    >
                      <option value="ask">Ask per row</option>
                      <option value="overwrite_all">Overwrite all</option>
                      <option value="skip_all">Skip all</option>
                    </select>
                  </div>
                </div>

                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="p-1">#</th>
                        <th className="p-1">studentId</th>
                        <th className="p-1">name</th>
                        <th className="p-1">email</th>
                        <th className="p-1">program</th>
                        <th className="p-1">year</th>
                        <th className="p-1">valid</th>
                        <th className="p-1">dup</th>
                        <th className="p-1">action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, idx) => {
                        const valid = validateCsvRow(r);
                        const existsLocally =
                          students.find((s) => s.id === String(r.studentId)) !==
                          undefined;
                        const decision =
                          perRowDecision[idx] ||
                          (existsLocally ? "ask" : "add");
                        return (
                          <tr
                            key={idx}
                            className={`${
                              !valid ? "opacity-60 bg-red-50" : ""
                            }`}
                          >
                            <td className="p-1">{r._line}</td>
                            <td className="p-1">{r.studentId || "—"}</td>
                            <td className="p-1">{r.name || "—"}</td>
                            <td className="p-1">{r.email || "—"}</td>
                            <td className="p-1">{r.program || "—"}</td>
                            <td className="p-1">{r.year || "—"}</td>
                            <td className="p-1">{valid ? "✔" : "✖"}</td>
                            <td className="p-1">
                              {existsLocally ? "Yes" : "No"}
                            </td>
                            <td className="p-1">
                              {existsLocally ? (
                                duplicateMode === "ask" ? (
                                  <select
                                    value={decision}
                                    onChange={(e) =>
                                      setDecisionForRow(
                                        idx,
                                        e.target.value as any
                                      )
                                    }
                                    className="text-xs border rounded p-1"
                                  >
                                    <option value="skip">Skip</option>
                                    <option value="overwrite">Overwrite</option>
                                  </select>
                                ) : (
                                  <span className="text-xs text-gray-600">
                                    {duplicateMode === "overwrite_all"
                                      ? "Overwrite"
                                      : "Skip"}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-600">
                                  Add
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => {
                      resetAddForm();
                      setShowAddModal(false);
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCsvImportConfirm}
                    className="px-3 py-2 bg-indigo-600 text-white rounded"
                  >
                    Import
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Certificate Modal (existing) ---------- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-indigo-700 mb-3">
              Certificates — {selectedStudent?.name}
            </h2>
            {selectedCertificate ? (
              <div className="flex flex-col items-center relative">
                <div className="w-full h-[65vh] border rounded-xl overflow-hidden mb-4 shadow-inner relative">
                  <iframe
                    src={selectedCertificate.fileURL}
                    title="Certificate PDF Preview"
                    className="w-full h-full rounded-lg border-0"
                  />
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

                <button
                  onClick={() => setSelectedCertificate(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition"
                >
                  ← Back to Certificates
                </button>
              </div>
            ) : (
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

      {/* Certificate Generator Modal can remain as-is from your original file */}
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
              disabled={!previewHTML || sending}
              className={`mt-4 w-full py-2 rounded-xl text-white font-medium 
    ${
      sending
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-emerald-600 hover:bg-emerald-700"
    }`}
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                    ></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                "🚀 Generate & Send"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
