import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../../App";
import { db } from "../../../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Search, Building2, Download, FileText } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  status: string;
  year: number;
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

  // Fetch college + students
  useEffect(() => {
    if (!mockID) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // College details
        const collegeSnap = await getDoc(doc(db, "colleges", mockID));
        if (collegeSnap.exists()) setCollegeDetails(collegeSnap.data());

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
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-xs transition">
                      View
                    </button>
                    <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-xs transition">
                      Certificate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
