"use client";
import { useEffect, useState, createContext, useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import Onboarding from "./pages/Onboarding";
import Organization from "./pages/dashboard/Organization";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Verifier from "./components/Verifier";
// ----------------- Organization Dashboard Components -----------------
import StudentsComponent from "./pages/dashboard/orgComponents/studentComponent";
import UploadTempComp from "./pages/dashboard/orgComponents/uploadTempComp";

// ----------------- Session Types -----------------
interface SessionData {
  role: "organization" | "individual" | "admin";
  mockID: string;
  userData: any;
  studentsData?: any[];
  sessionStart: number;
  sessionExpiry: number;
}

interface SessionContextType {
  session: SessionData | null;
  setSession: (data: SessionData | null) => void;
  logout: () => void;
}

// ----------------- Context -----------------
const SessionContext = createContext<SessionContextType>({
  session: null,
  setSession: () => {},
  logout: () => {},
});
export const useSession = () => useContext(SessionContext);

// ----------------- Session Manager -----------------
function SessionManager({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("session");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() < parsed.sessionExpiry) {
        setSession(parsed);
        if (location.pathname === "/") {
          if (parsed.role === "organization") navigate("/organization");
          else if (parsed.role === "individual") navigate("/individual");
          else if (parsed.role === "admin") navigate("/issuergenerator");
        }
        return;
      }
      localStorage.removeItem("session");
    }
  }, [navigate, location]);

  const logout = () => {
    localStorage.removeItem("session");
    setSession(null);
    navigate("/");
  };

  return (
    <TonConnectUIProvider manifestUrl="https://vishwaspatra.netlify.app/tonconnect-manifest.json">
      <SessionContext.Provider value={{ session, setSession, logout }}>
        {children}
      </SessionContext.Provider>{" "}
    </TonConnectUIProvider>
  );
}

// ----------------- Main App Routes -----------------
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/organization" element={<Organization />} />
      <Route path="/student-registrar" element={<StudentsComponent />} />
      <Route path="/upload-temp-comp" element={<UploadTempComp />} />
      <Route
        path="/individual"
        element={<div>Individual Dashboard - Coming Soon</div>}
      />
      <Route path="/verifier" element={<Verifier />} />
      <Route path="*" element={<Navigate to="/" replace />} />{" "}
    </Routes>
  );
}

// ----------------- Main App -----------------
export default function App() {
  return (
    <Router>
      {" "}
      <SessionManager>
        {" "}
        <AppRoutes />{" "}
      </SessionManager>{" "}
    </Router>
  );
}
