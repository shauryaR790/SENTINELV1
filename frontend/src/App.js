import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tracking from "./pages/Tracking";
import OSINT from "./pages/OSINT";
import Ingest from "./pages/Ingest";
import GraphPage from "./pages/GraphPage";
import Analytics from "./pages/Analytics";
import Mission from "./pages/Mission";
import SearchPage from "./pages/SearchPage";
import Audit from "./pages/Audit";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050914] text-cyan-300 font-mono text-sm">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-cyan-400 blink-dot"></span>
          ESTABLISHING SECURE CHANNEL…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/tracking" element={<Protected><Tracking /></Protected>} />
            <Route path="/osint" element={<Protected><OSINT /></Protected>} />
            <Route path="/ingest" element={<Protected><Ingest /></Protected>} />
            <Route path="/graph" element={<Protected><GraphPage /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/mission" element={<Protected><Mission /></Protected>} />
            <Route path="/search" element={<Protected><SearchPage /></Protected>} />
            <Route path="/audit" element={<Protected><Audit /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
