"use client";
import { useSession } from "../../App";
import { LogOut, Users, FileCheck, QrCode, Building2 } from "lucide-react";

export default function Organization() {
  const { session, logout } = useSession();
  const org = session?.userData || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm border-b border-indigo-100 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-indigo-600" />
          <h1 className="font-semibold text-lg">
            {org.name || "VishwasPatra College"}
          </h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </header>

      {/* Dashboard Content */}
      <main className="p-6 max-w-5xl mx-auto">
        {/* Welcome */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-indigo-700">
            Welcome, {org.adminName || "Admin"} 👋
          </h2>
          <p className="text-sm text-gray-600">
            Manage your verified certificates, students, and verification
            requests — all on-chain.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <StatCard
            icon={<Users className="text-indigo-600 w-6 h-6" />}
            label="Registered Students"
            value={session?.studentsData?.length || 0}
          />
          <StatCard
            icon={<FileCheck className="text-indigo-600 w-6 h-6" />}
            label="Certificates Issued"
            value={org.certificatesIssued || 0}
          />
          <StatCard
            icon={<QrCode className="text-indigo-600 w-6 h-6" />}
            label="Verifiers Connected"
            value={org.verifiers || 0}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <ActionCard
              title="Get VOIC (SBT)"
              desc="Obtain Verified Organization Identity Certificate instantly."
              gradient="from-emerald-500 to-teal-500"
              onClick={() => alert("Minting VOIC...")} // temporary, to be connected with API later
            />
            <ActionCard
              title="Generate Certificate"
              desc="Issue blockchain-verified certificates to your students."
              gradient="from-indigo-600 to-indigo-500"
            />
            <ActionCard
              title="Upload Templates"
              desc="Design and upload your certificate templates securely."
              gradient="from-purple-500 to-indigo-500"
            />
            <ActionCard
              title="Manage Students"
              desc="View, add, or update your student records and IDs."
              gradient="from-sky-500 to-indigo-600"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* --- Sub Components --- */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 flex flex-col items-center justify-center hover:shadow-md transition-all duration-300">
      <div className="mb-3">{icon}</div>
      <h4 className="text-xl font-semibold text-gray-800">{value}</h4>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  gradient,
  onClick,
}: {
  title: string;
  desc: string;
  gradient: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group bg-gradient-to-r ${gradient} text-white p-5 rounded-2xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300 text-left`}
    >
      <h4 className="text-base font-semibold mb-2">{title}</h4>
      <p className="text-xs text-white/80 mb-3">{desc}</p>
      <span className="text-xs font-medium group-hover:underline">
        Continue →
      </span>
    </button>
  );
}