"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "../../App";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Users,
  FileCheck,
  QrCode,
  Building2,
  Menu,
  ShieldCheck,
  Home,
  FileText,
  Upload,
  Settings,
} from "lucide-react";
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";

export default function Organization() {
  const navigate = useNavigate();
  const { session, logout } = useSession();
  const [loadingLogout, setLoadingLogout] = useState(false);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [loading, setLoading] = useState(false);
  const [nftExists, setNftExists] = useState(false);
  const [nftMetadata, setNftMetadata] = useState<any>(null); // or a proper type if you know the structure
  const [hasSBT, setHasSBT] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [org, setOrg] = useState<any>(session?.userData || {});
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const menuItems = [
    {
      icon: <Home size={18} />,
      label: "Dashboard",
      onClick: () => navigate("/organization"),
    },
    {
      icon: <Upload size={18} />,
      label: "Upload Logo",
      onClick: () => navigate("/upload-logo"),
    },
    {
      icon: <FileText size={18} />,
      label: "Templates",
      onClick: () => navigate("/upload-temp-comp"),
    },
    {
      icon: <Users size={18} />,
      label: "Students",
      onClick: () => navigate("/student-registrar"),
    },
    {
      icon: <ShieldCheck size={18} />,
      label: "Verification",
      onClick: () => navigate("/verifier"),
    },
    {
      icon: <Settings size={18} />,
      label: "Settings",
      onClick: () => navigate("/settings"),
    },
  ];

  // 🔹 On wallet connect, link with Firestore
  useEffect(() => {
    if (wallet?.account?.address) {
      handleWalletConnect(wallet.account.address);
    }
  }, [wallet]);

  useEffect(() => {
    const mockID = session?.mockID;
    if (!mockID) return;

    let hasFetched = false;

    async function checkNFTandThenSBT(id: string) {
      if (hasFetched) return;
      hasFetched = true;

      try {
        // 1️⃣ Fetch college doc
        const collegeRef = doc(db, "colleges", id);
        const collegeSnap = await getDoc(collegeRef);

        if (!collegeSnap.exists()) {
          console.warn("⚠️ College not found:", id);
          return;
        }

        const collegeData = collegeSnap.data();
        setOrg((prev: any) => ({ ...prev, ...collegeData }));

        // 2️⃣ Fetch NFT metadata subcollection
        const nftCollectionRef = collection(db, "colleges", id, "nftMetaData");
        const nftSnapshot = await getDocs(nftCollectionRef);

        if (!nftSnapshot.empty) {
          const allNFTs = nftSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          console.log("✅ All NFT metadata:", allNFTs);
          setNftExists(true);
          setNftMetadata(allNFTs);

          // 3️⃣ Trigger SBT verification after short delay
          setTimeout(() => {
            console.log("🚀 Triggering SBT verification...");
            verifySBT(id);
          }, 2500);
        } else {
          console.log("❌ No NFT metadata found for", id);
          setNftExists(false);
          setNftMetadata(null);
        }
      } catch (err) {
        console.error("Error checking NFT metadata:", err);
      }
    }

    checkNFTandThenSBT(mockID); // ✅ Pass mockID explicitly
  }, [session?.mockID]);

  // ✅ Self-contained verification function
  async function verifySBT(mockID: string) {
    try {
      if (!mockID) {
        console.warn("⚠️ Missing mockID for SBT verification");
        return;
      }

      console.log(
        `🔍 Fetching org data for verification (mockID: ${mockID})...`
      );

      // 🔹 Step 1: Get college document
      const collegeRef = doc(db, "colleges", mockID);
      const collegeSnap = await getDoc(collegeRef);

      if (!collegeSnap.exists()) {
        console.warn(`⚠️ No college found for mockID: ${mockID}`);
        return;
      }

      const collegeData = collegeSnap.data();
      const walletId = collegeData.walletId;
      const collegeName = collegeData.name;
      const deployAddr = collegeData.deployAddress ?? collegeData.sbtAddress;

      console.log("🏫 Loaded org data:", {
        walletId,
        collegeName,
        deployAddr,
      });

      // 🔍 Validate required data
      if (!walletId || !collegeName || !deployAddr) {
        console.warn("⚠️ Missing required fields for verification:", {
          walletId,
          collegeName,
          deployAddr,
        });
        return;
      }

      // 🔗 Build verification URL
      const endpoint = `${backendUrl}/api/verify-sbt?wallet=${encodeURIComponent(
        walletId
      )}&college=${encodeURIComponent(
        collegeName
      )}&deployAddress=${encodeURIComponent(deployAddr)}`;

      // 🚀 Step 2: Call backend
      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Backend verification error:", data);
        alert(`Verification failed: ${data.error || "Unknown error"}`);
        return;
      }

      // ✅ Step 3: Handle success
      console.log("✅ Verification result:", data);
      if (typeof data.hasSBT === "boolean") {
        setHasSBT(data.hasSBT);
        if (data.hasSBT) {
          console.log("🎯 SBT exists on-chain — verification successful!");
        } else {
          console.warn("⚠️ No SBT found for this organization.");
        }
      } else {
        console.warn("⚠️ Unexpected response structure:", data);
      }
    } catch (err) {
      console.error("❌ Error verifying SBT:", err);
      alert("Verification failed. Please check your backend connection.");
    }
  }

  async function handleWalletConnect(walletAddress: string) {
    try {
      const collegeId = session?.mockID; // dynamic later
      const shortName = org.shortName || "COLLEGE";

      if (!collegeId) {
        console.error("❌ College ID missing — cannot link wallet");
        return;
      }

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

  const handleVoicGeneration = async () => {
    const mockID = session?.mockID || org?.mockID;
    if (!mockID || !org?.walletId) {
      console.log("❌ Missing required data before send:", {
        mockID,
        walletId: org?.walletId,
      });
      return;
    }

    // 🔍 Double-check backend (Firestore)
    try {
      const docRef = doc(db, "colleges", mockID, "nftMetaData", "latest");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("❌ VOIC (SBT) already exists (backend check)");
        setNftExists(true);
        return;
      }
    } catch (err) {
      console.error("❌ Error checking NFT metadata before generation:", err);
      return;
    }

    // ✅ Proceed
    try {
      setLoading(true);

      const payload = {
        collegeName: org.name,
        regId: org.regId,
        walletId: org.walletId,
        mockId: mockID, // should never be undefined
      };

      // 🟢 Log before sending
      console.log("📤 Payload to be sent:", JSON.stringify(payload, null, 2));

      const res = await fetch(`${backendUrl}/api/generate-voic-sbt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("✅ Response from backend:", data);

      if (res.ok) {
        alert("✅ VOIC (SBT) generation request sent successfully!");
        setNftExists(true);
      } else {
        alert(`❌ Error: ${data.error || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("❌ Error while minting VOIC:", err);
      alert("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const handleVoicSBTGeneration = async () => {
    try {
      setLoading(true);

      // 🔍 STEP 1: Validate NFT metadata
      if (!nftMetadata) {
        console.warn("❌ No NFT metadata available in state.");
        return;
      }

      // 🔍 STEP 2: Extract and log all possible values clearly
      const metaUri =
        nftMetadata?.[0]?.metadata ||
        nftMetadata?.metadata ||
        nftMetadata?.metaUri ||
        null;

      const walletId = org?.walletId || "❌ MISSING";
      const mockID = session?.mockID || org?.mockID || "❌ MISSING";

      console.log("🧩 NFT Metadata snapshot:", nftMetadata);
      console.log("🪙 Wallet ID:", walletId);
      console.log("🏫 Mock ID:", mockID);
      console.log("🌐 Meta URI:", metaUri);

      // 🔍 STEP 3: Early exit if required fields missing
      if (!metaUri || !walletId || !mockID) {
        console.error("❌ Required fields missing before backend call:", {
          metaUri,
          walletId,
          mockID,
        });
        alert(
          "Cannot mint — missing required data. Check console for details."
        );
        return;
      }

      // ✅ STEP 4: Construct clean payload
      const payload = {
        metaUri,
        walletId,
        mockID,
      };

      console.log(
        "📤 Final Payload to be sent:",
        JSON.stringify(payload, null, 2)
      );

      // 🔥 STEP 5: Send to backend
      const res = await fetch(`${backendUrl}/api/mint-voic-sbt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("✅ Response from backend:", data);

      if (res.ok) {
        alert("✅ VOIC (SBT) minted successfully!");
      } else {
        alert(`❌ Error: ${data.error || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("❌ Error while minting VOIC:", err);
      alert("Failed to connect to backend");
    } finally {
      setLoading(false);
      setNftExists(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // reset previous file
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ Validate file size (max 500 KB)
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      alert("Logo size should not exceed 500 KB.");
      return;
    }

    // --- Example variables from your app state/context ---
    const mockID = session?.mockID;
    const walletId = org.walletId;
    const regId = org.regId;
    const fullName = org.name;
    const shortName = org.shortName;

    // ✅ Prepare form data
    const formData = new FormData();
    formData.append("logo", file); // must match multer field name
    formData.append("mockID", mockID ?? "");
    formData.append("walletId", walletId);
    formData.append("regId", regId);
    formData.append("fullName", fullName);
    formData.append("shortName", shortName);

    try {
      const res = await fetch(`${backendUrl}/api/mint-logo-sbt`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("✅ Uploaded Logo Response:", data);

      if (res.ok) {
        alert("Logo uploaded successfully!");
      } else {
        alert(`Failed: ${data.message || "Server error"}`);
      }
    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("Failed to upload logo.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm border-b border-indigo-100 sticky top-0 z-20">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h1 className="font-semibold text-lg text-indigo-700">
            VishwasPatra
          </h1>
        </div>

        {/* Right: Burger Menu */}
        <button
          onClick={() => setMenuOpen(true)}
          className="text-indigo-600 hover:text-indigo-800 transition"
        >
          <Menu size={24} />
        </button>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Sidebar */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 110, damping: 22 }}
              className="fixed right-0 top-0 h-full w-60 
                   bg-grey/50 backdrop-blur-md
                   border-l border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.15)] 
                   z-40 flex flex-col rounded-l-3xl"
            >
              {/* Header */}
              <div
                className="bg-white/50 backdrop-blur-xl 
                        border-b border-white/40 
                        px-5 py-4 flex justify-between items-center 
                        rounded-tl-3xl shadow-sm"
              >
                <h2 className="text-lg font-semibold text-indigo-700 tracking-wide drop-shadow-sm">
                  VishwasPatra
                </h2>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-500 hover:text-indigo-600 transition"
                >
                  ✕
                </button>
              </div>

              {/* Wallet */}
              <div className="flex justify-center mt-6 mb-3">
                <TonConnectButton />
              </div>

              {/* Menu Items */}
              <nav className="flex-1 px-3 mt-3 space-y-2 overflow-y-auto">
                {menuItems.map((item, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="group flex items-center gap-3 w-full px-3 py-2.5
                         text-gray-700 hover:text-indigo-700 bg-white/60
                         hover:bg-white/60 hover:shadow-[0_0_10px_rgba(99,102,241,0.3)]
                         rounded-xl transition-all duration-300
                         text-sm font-medium border border-grey/40
                         backdrop-blur-md"
                  >
                    <div className="text-indigo-500 group-hover:text-indigo-700 transition-colors">
                      {item.icon}
                    </div>
                    <span className="truncate">{item.label}</span>
                  </motion.button>
                ))}
              </nav>

              {/* Logout */}
              <div className="border-t border-white/40 mt-auto p-4 backdrop-blur-md">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5
                       bg-gradient-to-r from-indigo-500 to-blue-500
                       text-white rounded-xl shadow-md
                       hover:shadow-lg active:scale-95 transition-all duration-300
                       text-sm font-semibold"
                >
                  <LogOut size={18} />
                  Logout
                </motion.button>

                <p className="text-[11px] text-center text-gray-500 mt-3 opacity-80">
                  © {new Date().getFullYear()} VishwasPatra
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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
            value={org.certificatesIssued || 0 || org.certificateIssued}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {!hasSBT && (
              <button
                onClick={
                  nftExists ? handleVoicSBTGeneration : handleVoicGeneration
                }
                disabled={loading}
                className={`group bg-gradient-to-r ${
                  nftExists
                    ? "from-blue-500 to-indigo-500"
                    : "from-emerald-500 to-teal-500"
                } text-white p-5 rounded-2xl shadow-md transition-transform duration-300 text-left ${
                  loading
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                <h4 className="text-base font-semibold mb-2">
                  {nftExists ? "Get VOIC SBT on-chain" : "Get VOIC Certificate"}
                </h4>
                <p className="text-xs text-white/80 mb-3">
                  Obtain Verified Organization Identity Certificate instantly.
                </p>
                {loading && (
                  <p className="text-xs text-gray-300 mt-2">Processing...</p>
                )}
              </button>
            )}

            <>
              <button
                onClick={!org?.logo?.length ? handleUploadClick : undefined}
                disabled={!!org?.logo?.length}
                className={`group p-5 rounded-2xl shadow-md transition-transform duration-300 text-left 
    ${
      org?.logo?.length
        ? "bg-gradient-to-r from-purple-500 to-indigo-500 cursor-not-allowed opacity-60"
        : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]"
    }
  `}
              >
                <h4 className="text-base font-semibold mb-2">Upload Logo</h4>
                <p className="text-xs text-white/80 mb-3">
                  Add or update your institution’s logo for certificates.
                </p>

                {org?.logo?.length > 0 && (
                  <p className="text-xs text-red-100 mt-2 font-medium">
                    Logo already uploaded — cannot upload again.
                  </p>
                )}
              </button>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
            </>

            <button
              onClick={() =>
                navigate("/upload-temp-comp", {
                  state: { mockID: session?.mockID },
                })
              }
              className="group bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-5 rounded-2xl shadow-md transition-transform duration-300 text-left hover:scale-[1.02] active:scale-[0.98]"
            >
              <h4 className="text-base font-semibold mb-2">Upload Templates</h4>
              <p className="text-xs text-white/80 mb-3">
                Add or update certificate templates with custom fields and
                branding.
              </p>
            </button>

            <button
              onClick={() =>
                navigate("/student-registrar", {
                  state: { mockID: session?.mockID },
                })
              }
              className="group bg-gradient-to-r from-sky-500 to-indigo-600 text-white p-5 rounded-2xl shadow-md transition-transform duration-300 text-left hover:scale-[1.02] active:scale-[0.98]"
            >
              <h4 className="text-base font-semibold mb-2">Manage Students</h4>
              <p className="text-xs text-white/80 mb-3">
                Register students, assign certificates, and manage record
                access.
              </p>
            </button>
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
