"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  GraduationCap,
  ScanLine,
  Users,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../App";
import { db } from "../firebaseConfig";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

interface SessionData {
  role: "organization";
  mockID: string;
  userData: any;
  studentsData: any[];
  sessionStart: number;
  sessionExpiry: number;
}

const slides = [
  {
    id: 1,
    title: "Welcome to TrustLedger",
    subtitle: "The decentralized trust network",
    subtext: "TON-powered verification",
    icon: <ShieldCheck className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 2,
    title: "Issue Securely",
    subtitle: "Blockchain certificates",
    subtext: "Tamper-proof issuance",
    icon: <Users className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 3,
    title: "Own with Confidence",
    subtitle: "Digital credentials",
    subtext: "Lifelong access",
    icon: <GraduationCap className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 4,
    title: "Verify Instantly",
    subtitle: "QR + hash verification",
    subtext: "Catch fakes instantly",
    icon: <ScanLine className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 5,
    title: "Get Started",
    subtitle: "Choose your role",
    subtext: "Organization or Verifier",
    icon: <ArrowRight className="w-16 h-16 text-indigo-600" />,
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const { setSession } = useSession();

  const [showCollegeForm, setShowCollegeForm] = useState(false);
  const [collegeData, setCollegeData] = useState({
    name: "",
    shortName: "",
    email: "",
    website: "",
    city: "",
    state: "",
    country: "India",
  });

  const [telegramUser, setTelegramUser] = useState<any>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      tg.ready();

      const idInterval = setInterval(() => {
        const u = tg.initDataUnsafe?.user;
        if (u) {
          setTelegramUser(u);
          clearInterval(idInterval);
        }
      }, 120);

      setTimeout(() => clearInterval(idInterval), 3000);
      return;
    }

    if (location.hostname === "localhost") {
      setTelegramUser({
        id: "mock_" + Math.floor(100000 + Math.random() * 999999),
        first_name: "MockDev",
        username: "mock_dev",
        isMock: true,
      });
      return;
    }

    setTelegramUser(null);
  }, []);

  // -----------------------------------
  // STEP 2: Check existing user OR create mock/college
  // -----------------------------------
  const checkExistingUser = async () => {
    if (!telegramUser) {
      alert("Please open inside Telegram");
      return;
    }

    const telegramId = String(telegramUser.id);

    if (telegramUser.isMock) {
      const mockCollegeId = "college_001";

      const collegeRef = doc(db, "colleges", mockCollegeId);
      const collegeSnap = await getDoc(collegeRef);

      if (!collegeSnap.exists()) {
        await setDoc(collegeRef, {
          isMock: true,
          mockLabel: "Local Dev Mock College",
          createdAt: Date.now(),
        });
      }

      const mockUserData = {
        telegramId,
        role: "admin",
        name: "Local Dev",
        username: telegramUser.username || "mock_dev",
        collegeId: mockCollegeId,
        isMock: true,
      };

      const sessionData: SessionData = {
        role: "organization",
        mockID: mockCollegeId,
        userData: mockUserData,
        studentsData: [],
        sessionStart: Date.now(),
        sessionExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      localStorage.setItem("session", JSON.stringify(sessionData));
      setSession(sessionData);
      navigate("/organization");
      return;
    }

    const collegesSnap = await getDocs(collection(db, "colleges"));
    for (const collegeDoc of collegesSnap.docs) {
      const collegeId = collegeDoc.id;
      const empRef = doc(db, "colleges", collegeId, "employee", telegramId);
      const empSnap = await getDoc(empRef);

      if (empSnap.exists()) {
        const userData = empSnap.data();

        const sessionData: SessionData = {
          role: "organization",
          mockID: collegeId,
          userData,
          studentsData: [],
          sessionStart: Date.now(),
          sessionExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };

        localStorage.setItem("session", JSON.stringify(sessionData));
        setSession(sessionData);
        navigate("/organization");
        return;
      }
    }

    setShowCollegeForm(true);
  };

  // -----------------------------------
  // STEP 3: Generate College ID and RegID helpers
  // -----------------------------------
  const generateCollegeId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 8; i++)
      id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  };

  const generateRegId = (state: string, shortName: string) => {
    const stateShort = (state || "XX").slice(0, 2).toUpperCase();
    const sname = (shortName || "COL").slice(0, 8).toUpperCase();
    const num = Math.floor(1000 + Math.random() * 9000);
    return `VP-${stateShort}-${sname}-${num}`;
  };

  // -----------------------------------
  // STEP 4: Register College + Admin Employee (production only)
  // -----------------------------------
  const createCollegeAndAdmin = async () => {
    if (!telegramUser) {
      alert("Telegram user not detected. Open in Telegram Mini App.");
      return;
    }

    const collegeId = generateCollegeId();
    const telegramId = String(telegramUser.id);
    const regId = generateRegId(collegeData.state, collegeData.shortName);

    // -----------------------------------
    // 1. Create college document
    // -----------------------------------
    await setDoc(doc(db, "colleges", collegeId), {
      ...collegeData,
      regId,
      createdAt: Date.now(),
      isMock: false,
    });

    // -----------------------------------
    // 2. Create Admin Employee (telegramId = doc id)
    // -----------------------------------
    const adminData = {
      telegramId,
      role: "admin",
      name: telegramUser.first_name || "",
      username: telegramUser.username || "",
      collegeId,
      regId,
      createdAt: Date.now(),
    };

    await setDoc(
      doc(db, "colleges", collegeId, "employee", telegramId),
      adminData
    );

    // -----------------------------------
    // 3. Create Session and navigate
    // -----------------------------------
    const sessionData: SessionData = {
      role: "organization",
      mockID: collegeId,
      userData: adminData,
      studentsData: [],
      sessionStart: Date.now(),
      sessionExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    localStorage.setItem("session", JSON.stringify(sessionData));
    setSession(sessionData);
    navigate("/organization");
  };

  // -------------------------------------------------------------------------
  // UI: slides, onboarding, registration form
  // -------------------------------------------------------------------------
  const nextSlide = () =>
    setIndex((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  const prevSlide = () => setIndex((prev) => (prev > 0 ? prev - 1 : prev));
  const current = slides[index];

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-white to-indigo-50 px-6 text-center pb-6 relative">
      {showCollegeForm ? (
        <div className="w-full max-w-md mt-12">
          <h2 className="text-xl font-semibold mb-4 text-indigo-700">
            Register Your College
          </h2>

          {Object.keys(collegeData).map((key) => (
            <input
              key={key}
              value={(collegeData as any)[key]}
              placeholder={key}
              onChange={(e) =>
                setCollegeData({ ...collegeData, [key]: e.target.value })
              }
              className="w-full mb-3 px-3 py-2 border rounded-lg"
            />
          ))}

          <button
            onClick={createCollegeAndAdmin}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl mt-4"
          >
            Create College
          </button>
        </div>
      ) : (
        <>
          {index > 0 && (
            <button
              onClick={prevSlide}
              className="absolute top-5 left-5 text-indigo-600 text-sm font-medium"
            >
              Back
            </button>
          )}

          <div className="flex flex-col items-center justify-center flex-grow mt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.45 }}
                className="max-w-xs"
              >
                <div className="flex justify-center mb-6">{current.icon}</div>
                <h1 className="text-2xl font-semibold mb-2 text-gray-800">
                  {current.title}
                </h1>
                <p className="text-gray-700 text-sm mb-3 font-medium">
                  {current.subtitle}
                </p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  {current.subtext}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center gap-5 mt-auto mb-4 w-full px-10">
            {index < slides.length - 1 ? (
              <button
                onClick={nextSlide}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl shadow-lg"
              >
                Next
              </button>
            ) : (
              <>
                <button
                  onClick={checkExistingUser}
                  className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl shadow-lg"
                >
                  College
                </button>

                <button
                  onClick={() => navigate("/verifier")}
                  className="w-full bg-white border border-indigo-600 text-indigo-600 py-3.5 rounded-2xl"
                >
                  Verifier
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
