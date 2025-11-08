import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../../App";
import { db } from "../../../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Search, Building2, Download, FileText } from "lucide-react";
import { fetchTemplateContentFromFirestore } from "../../../utils/firestoreTemplateUtils";

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
      const certRef = collection(
        db,
        "colleges",
        mockID,
        "students",
        student.id,
        "certificate"
      );
      const certSnap = await getDocs(certRef);

      if (certSnap.empty) {
        alert(`No certificate found for ${student.name}`);
        return;
      }

      const certList = certSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCertificates(certList);
      setSelectedStudent(student);
      setShowModal(true);
    } catch (err) {
      console.error("Error fetching certificates:", err);
      alert("Failed to fetch certificate details.");
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-white shadow-lg border-b border-indigo-100 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-3 md:mb-0">
          <Building2 className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {collegeDetails.name}
            </h1>
            {collegeDetails.address && (
              <p className="text-sm text-gray-500">{collegeDetails.address}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition transform hover:scale-105"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm transition transform hover:scale-105">
            <FileText className="w-5 h-5" />
            Import CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center mt-6">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-3 left-3 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, program..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-xl p-2 shadow-sm"
          value={statusFilter ?? ""}
          onChange={(e) => setStatusFilter(e.target.value || null)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="border border-gray-300 rounded-xl p-2 shadow-sm"
          value={programFilter ?? ""}
          onChange={(e) => setProgramFilter(e.target.value || null)}
        >
          <option value="">All Programs</option>
          {[...new Set(students.map((s) => s.program))].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-xl p-2 shadow-sm"
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

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-indigo-50">
            <tr>
              {["Name", "Email", "Program", "Status", "Year", "Actions"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => {
                      const key = col.toLowerCase() as keyof Student;
                      if (sortField === key)
                        setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortField(key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {col}{" "}
                    {sortField === col.toLowerCase()
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-6 text-gray-400 font-medium"
                >
                  No students found.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`transition hover:bg-indigo-50 ${
                    idx % 2 === 0 ? "bg-white" : "bg-indigo-50/50"
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {s.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {s.program}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        s.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {s.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleViewCertificates(s)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-xs transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStudent(s);
                        setShowCertModal(true);
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-xs transition"
                    >
                      Certificate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Certificates Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Certificates of {selectedStudent?.name}
            </h2>
            <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
              {certificates.map((c) => (
                <li
                  key={c.id}
                  className="py-2 text-sm text-gray-700 flex justify-between items-center"
                >
                  <span>{c.title || c.id}</span>
                  {c.fileURL && (
                    <a
                      href={c.fileURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline text-xs"
                    >
                      View File
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 w-full transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Certificate Generation Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 overflow-y-auto max-h-[90vh] relative">
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
            <h2 className="text-xl font-semibold mb-4">
              Generate Certificate for {selectedStudent?.name}
            </h2>

            {/* Step 1: Type */}
            <div className="flex gap-3 mb-4">
              {["degree", "certificate"].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setCertType(type as "degree" | "certificate");
                    setSelectedTemplate(null);
                    setPreviewHTML("");
                  }}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                    certType === type
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            {/* Step 2: Template */}
            {certType && (
              <div className="mb-4">
                <h3 className="text-gray-700 font-medium mb-2">
                  Select Template
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {templates
                    .filter((t) => t.type.toLowerCase() === certType)
                    .map((t) => (
                      <button
                        key={t.templateId}
                        onClick={() => handleTemplateSelect(t)}
                        className={`p-3 border rounded-lg text-left hover:bg-indigo-50 transition text-sm ${
                          selectedTemplate?.templateId === t.templateId
                            ? "border-indigo-600 bg-indigo-50"
                            : "border-gray-200"
                        }`}
                      >
                        <p className="font-medium text-gray-800">
                          {t.certificateName || t.name}
                        </p>
                        <p className="text-xs text-gray-500">{t.type}</p>
                      </button>
                    ))}
                </div>
              </div>
            )}
            {/* Step 3: Preview */}
            {loadingPreview ? (
              <div className="text-center text-gray-500">
                Loading preview...
              </div>
            ) : previewHTML ? (
              <iframe
                srcDoc={previewHTML}
                title="Certificate Preview"
                className="w-full h-[60vh] border rounded-lg"
              />
            ) : (
              <p className="text-sm text-gray-400 text-center">
                Select a template to see preview
              </p>
            )}
            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCertModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              {previewHTML && (
                <button
                  onClick={sendCertificate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Generate & Send
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
