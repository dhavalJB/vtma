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
import { useSession } from "../App"; // ✅ import context
import { db } from "../firebaseConfig";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const slides = [
  {
    id: 1,
    title: "Welcome to VishwasPatra",
    subtitle: "The decentralized trust network for authentic documents.",
    subtext:
      "Built on the TON blockchain for India’s digital future — enabling secure, verified, and lifelong ownership of every important certificate or document.",
    icon: <ShieldCheck className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 2,
    title: "Issue Securely",
    subtitle: "Organizations issue verified digital certificates on TON.",
    subtext:
      "Colleges, universities, and institutions can issue blockchain-verified academic records, IDs, and certifications instantly — no intermediaries or tampering.",
    icon: <Users className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 3,
    title: "Own with Confidence",
    subtitle: "Individuals hold tamper-proof certificates in their wallet.",
    subtext:
      "Students and citizens own soulbound digital credentials — permanently verifiable, accessible, and linked to their identity.",
    icon: <GraduationCap className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 4,
    title: "Verify Instantly",
    subtitle: "Verify authenticity in seconds — no fakes, no paper.",
    subtext:
      "Employers, institutions, or anyone can validate authenticity instantly via QR code or blockchain hash lookup.",
    icon: <ScanLine className="w-16 h-16 text-indigo-600" />,
  },
  {
    id: 5,
    title: "Get Started",
    subtitle: "Select your role to begin your journey on VishwasPatra.",
    subtext:
      "Choose whether you are an Organization or an Individual to continue.",
    icon: <ArrowRight className="w-16 h-16 text-indigo-600" />,
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const { setSession } = useSession(); // ✅ get from context

  // Check existing session
  useEffect(() => {
    const session = localStorage.getItem("session");
    if (session) {
      try {
        const data = JSON.parse(session);
        if (Date.now() < data.sessionExpiry) navigate(`/${data.role}`);
        else localStorage.removeItem("session");
      } catch {
        localStorage.removeItem("session");
      }
    }
  }, [navigate]);

  const nextSlide = () =>
    setIndex((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  const prevSlide = () => setIndex((prev) => (prev > 0 ? prev - 1 : prev));

  // ✅ Firestore Login / Session Setup
  const handleRoleSelect = async (role: "organization" | "individual") => {
    try {
      const mockID = role === "organization" ? "college_001" : "student_001";
      const docRef = doc(
        db,
        role === "organization" ? "colleges" : "students",
        mockID
      );
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        alert("User not found in Firestore!");
        return;
      }

      const userData = docSnap.data();
      let studentsData: any[] = [];

      if (role === "organization") {
        const studentsRef = collection(db, `colleges/${mockID}/students`);
        const studentSnap = await getDocs(studentsRef);
        studentsData = studentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }

      const sessionData = {
        role,
        mockID,
        userData,
        studentsData,
        sessionStart: Date.now(),
        sessionExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      // ✅ Update both localStorage and context
      localStorage.setItem("session", JSON.stringify(sessionData));
      setSession(sessionData); // now context knows
      navigate(`/${role}`);
    } catch (error) {
      console.error("Error initializing session:", error);
      alert("Failed to start session. Please try again.");
    }
  };

  const current = slides[index];

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-white to-indigo-50 px-6 text-center pb-6 relative">
      {index > 0 && (
        <button
          onClick={prevSlide}
          className="absolute top-5 left-5 text-indigo-600 text-sm font-medium"
        >
          Back
        </button>
      )}

      {/* Slide Content */}
      <div className="flex flex-col items-center justify-center flex-grow mt-10">
        <AnimatePresence mode="wait" custom={index}>
          <motion.div
            key={current.id}
            custom={index}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
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

      {/* Bottom Dots + Actions */}
      <div className="flex flex-col items-center gap-5 mt-auto mb-4 w-full px-10">
        {index < slides.length - 1 && (
          <div className="flex justify-center gap-2 mb-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i === index ? "bg-indigo-600 scale-110" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        )}

        {index < slides.length - 1 ? (
          <button
            onClick={nextSlide}
            className="group relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white py-3.5 rounded-2xl shadow-lg text-sm font-semibold active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10">Next</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></span>
          </button>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => handleRoleSelect("organization")}
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white py-3.5 rounded-2xl shadow-md text-sm font-semibold active:scale-95 transition-all duration-300"
            >
              Organization
            </button>
            <button
              onClick={() => handleRoleSelect("individual")}
              className="bg-white border border-indigo-600 text-indigo-600 py-3.5 rounded-2xl shadow-md text-sm font-semibold active:scale-95 transition-all duration-300"
            >
              Individual
            </button>
            <button
              onClick={() => navigate("/verifier")}
              className="bg-white border border-indigo-600 text-indigo-600 py-3.5 rounded-2xl shadow-md text-sm font-semibold active:scale-95 transition-all duration-300"
            >
              Verifier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
