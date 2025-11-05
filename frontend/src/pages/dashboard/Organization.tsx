"use client";
import { useEffect, useState } from "react";
import { useSession } from "../../App";
import { LogOut, Users, FileCheck, QrCode, Building2 } from "lucide-react";
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function Organization() {
  const { session, logout } = useSession();
  const org = session?.userData || {};
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [loading, setLoading] = useState(false);

  // 🔹 On wallet connect, link with Firestore
  useEffect(() => {
    if (wallet?.account?.address) {
      handleWalletConnect(wallet.account.address);
    }
  }, [wallet]);

  async function handleWalletConnect(walletAddress: string) {
    try {
      const collegeId = org.collegeId || "college_001"; // dynamic later
      const shortName = org.shortName || "SVIT";
      const collegeRef = doc(db, "colleges", collegeId);
      const collegeSnap = await getDoc(collegeRef);

      let regId: string;

      // --- 1️⃣ Update college document ---
      if (collegeSnap.exists()) {
        const data = collegeSnap.data();

        if (!data.walletId) {
          const random = Math.floor(1000 + Math.random() * 9000);
          regId = `VP-GJ-${shortName}-${random}`;
          await updateDoc(collegeRef, {
            walletId: walletAddress,
            regId,
            updatedAt: new Date().toISOString(),
          });
          console.log("✅ College wallet linked:", regId);
        } else {
          regId = data.regId;
          console.log("ℹ️ College already linked:", regId);
        }
      } else {
        console.warn("⚠️ College not found:", collegeId);
        return;
      }

      // --- 2️⃣ Add to registrar collection ---
      const registrarRef = doc(db, "collegeRegistrar", regId);
      const registrarSnap = await getDoc(registrarRef);
      if (!registrarSnap.exists()) {
        await setDoc(registrarRef, {
          walletId: walletAddress,
          regId,
          createdAt: new Date().toISOString(),
        });
        console.log("✅ Added to collegeRegistrar:", regId);
      } else {
        console.log("ℹ️ Registrar entry already exists:", regId);
      }
    } catch (err) {
      console.error("❌ Wallet connection failed:", err);
    }
  }

  const handleMintVOIC = async () => {
    try {
      setLoading(true);

      const payload = {
        collegeName: org.name,
        regId: org.regId,
        walletId: org.walletId,
        mockId: session.mockID,
      };

      console.log("📤 Sending payload to backend:", payload);

      const res = await fetch("http://localhost:5000/api/generate-sbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("✅ Response:", data);

      if (res.ok) {
        alert("VOIC (SBT) generation request sent successfully!");
      } else {
        alert(`Error: ${data.error || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("❌ Error while minting VOIC:", err);
      alert("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

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

        <div className="flex items-center gap-4">
          <TonConnectButton />
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
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
              onClick={handleMintVOIC}
            >
              {loading && (
                <p className="text-xs text-gray-400 mt-2">Processing...</p>
              )}
            </ActionCard>
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
