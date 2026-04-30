import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Globe2, Plane, Users, FileStack, Share2, BarChart3,
  Target, SearchCode, ShieldCheck, LogOut, Radio
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Marquee from "react-fast-marquee";

const modules = [
  { to: "/", icon: Globe2, label: "Global Overview" },
  { to: "/tracking", icon: Plane, label: "Air & Maritime" },
  { to: "/osint", icon: Users, label: "OSINT People" },
  { to: "/ingest", icon: FileStack, label: "Data Ingestion" },
  { to: "/graph", icon: Share2, label: "Relationship Graph" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/mission", icon: Target, label: "Mission Control" },
  { to: "/search", icon: SearchCode, label: "Advanced Search" },
];

export default function Layout({ children, fullBleed = false }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").slice(0, 19) + "Z";

  return (
    <div className="flex flex-col h-screen overflow-hidden" data-testid="app-layout">
      {/* Classified banner */}
      <div
        className="classified-stripe h-6 text-black font-mono text-[11px] font-bold flex items-center justify-center tracking-[0.3em] uppercase shrink-0"
        data-testid="classified-banner"
      >
        UNCLASSIFIED // NOTIONAL DATA // FOR DEMONSTRATION
      </div>

      {/* Top bar */}
      <div className="h-12 border-b border-cyan-400/20 bg-[#050914]/90 backdrop-blur-md flex items-center px-4 shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-cyan-400/60 flex items-center justify-center relative glow-cyan">
            <Radio className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-bold tracking-[0.25em] text-cyan-100">SENTINEL</span>
            <span className="font-mono text-[9px] tracking-[0.3em] text-cyan-400/70">OSINT // CMD-7</span>
          </div>
        </div>

        <div className="ml-8 flex-1 flex items-center gap-6 text-[11px] font-mono text-slate-400">
          <span className="text-slate-500">NODE</span><span className="text-cyan-300">GW-01</span>
          <span className="text-slate-500">UTC</span><span className="text-cyan-300" data-testid="utc-clock">{ts}</span>
          <span className="text-slate-500">LINK</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink-dot"></span>SECURE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="font-display text-sm text-cyan-100 tracking-wider">{user?.name || "—"}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">{user?.role || "guest"}</div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={async () => { await logout(); nav("/login"); }}
            className="w-8 h-8 border border-cyan-400/30 hover:border-red-400 hover:text-red-400 text-cyan-300 flex items-center justify-center transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body: left rail + content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left rail */}
        <nav className="w-14 border-r border-cyan-400/20 bg-[#050914]/80 flex flex-col items-center py-3 gap-1 shrink-0" data-testid="left-rail">
          {modules.map(m => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === "/"}
              data-testid={`nav-${m.to.replace("/", "") || "home"}`}
              className={({ isActive }) =>
                `relative w-10 h-10 flex items-center justify-center transition group ${
                  isActive
                    ? "text-cyan-300 bg-cyan-400/10 border-l-2 border-cyan-400"
                    : "text-slate-500 hover:text-cyan-300 hover:bg-cyan-400/5"
                }`
              }
              title={m.label}
            >
              <m.icon className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-[#0a1020] border border-cyan-400/30 text-[11px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50">
                {m.label}
              </span>
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/audit" data-testid="nav-audit" className={({ isActive }) =>
              `relative w-10 h-10 flex items-center justify-center transition group mt-auto ${
                isActive ? "text-amber-300 bg-amber-400/10 border-l-2 border-amber-400" : "text-slate-500 hover:text-amber-300"
              }`
            } title="Audit Log">
              <ShieldCheck className="w-5 h-5" />
            </NavLink>
          )}
        </nav>

        {/* Main content */}
        <main className={`flex-1 overflow-hidden relative ${fullBleed ? "" : ""}`} data-testid="main-content">
          {children}
        </main>
      </div>

      {/* Bottom ticker */}
      <div className="h-6 border-t border-cyan-400/20 bg-[#050914]/95 flex items-center shrink-0 fade-edges" data-testid="ticker">
        <span className="font-mono text-[10px] text-critical px-3 tracking-wider shrink-0">● LIVE FEED</span>
        <Marquee speed={40} gradient={false} pauseOnHover className="font-mono text-[11px] text-slate-400">
          <span className="px-6">SIGINT// Intercepted comm fragment near Donetsk @ 04:12Z</span>
          <span className="px-6 text-amber-400">WARN// Unidentified surface contact in Red Sea sector 14</span>
          <span className="px-6">IMINT// Armored column movement Suwalki corridor +3hr</span>
          <span className="px-6 text-cyan-300">HUMINT// Source TANGO reports unrest escalation Caracas</span>
          <span className="px-6 text-critical">CRITICAL// Embassy threat level raised to DELTA</span>
          <span className="px-6">CYBER// Ransomware signature detected UK healthcare net</span>
          <span className="px-6 text-amber-400">OSINT// Social media anomaly cluster Tehran +18%</span>
        </Marquee>
      </div>
    </div>
  );
}
