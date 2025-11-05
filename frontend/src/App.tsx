"use client";
import React, { useEffect, useState, createContext, useContext } from "react";
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

// ----------------- Context Setup -----------------
const SessionContext = createContext<SessionContextType>({
  session: null,
  setSession: () => {},
  logout: () => {},
});

export const useSession = () => useContext(SessionContext);

// ----------------- Protected Route -----------------
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session } = useSession();
  const isValid =
    session && session.sessionExpiry && Date.now() < session.sessionExpiry;

  if (!isValid) {
    localStorage.removeItem("session");
    return <Navigate to="/" replace />;
  }

  return children;
}

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
        // Auto redirect for existing sessions
        if (location.pathname === "/") {
          if (parsed.role === "organization") navigate("/organization");
          else if (parsed.role === "individual") navigate("/individual");
          else if (parsed.role === "admin") navigate("/issuergenerator");
        }
        return;
      }
      localStorage.removeItem("session");
    }

    // Auto-generate admin session if route is IssuerGenerator
    if (location.pathname === "/issuergenerator") {
      const adminSession: SessionData = {
        role: "admin",
        mockID: "admin-001",
        userData: { name: "Admin", email: "admin@vishwaspatra.gov.in" },
        sessionStart: Date.now(),
        sessionExpiry: Date.now() + 1000 * 60 * 60, // 1 hour
      };
      setSession(adminSession);
      localStorage.setItem("session", JSON.stringify(adminSession));
    }
  }, [navigate, location]);

  useEffect(() => {
    if (session) localStorage.setItem("session", JSON.stringify(session));
  }, [session]);

  const logout = () => {
    localStorage.removeItem("session");
    setSession(null);
    navigate("/");
  };

  return (
    <TonConnectUIProvider manifestUrl="https://vishwaspatra.netlify.app/tonconnect-manifest.json">
      <SessionContext.Provider value={{ session, setSession, logout }}>
        {children}
      </SessionContext.Provider>
    </TonConnectUIProvider>
  );
}

// ----------------- Routes -----------------
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route
        path="/organization"
        element={
          <ProtectedRoute>
            <Organization />
          </ProtectedRoute>
        }
      />
      <Route
        path="/individual"
        element={
          <ProtectedRoute>
            <div className="p-6 text-center text-gray-700">
              <h1 className="text-2xl font-semibold">Individual Dashboard</h1>
              <p className="mt-2">Coming soon...</p>
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ----------------- Main App -----------------
export default function App() {
  return (
    <Router>
      <SessionManager>
        <AppRoutes />
      </SessionManager>
    </Router>
  );
}
