import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatApiError } from "../lib/api";
import { ShieldCheck, Lock, User, Radio } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@sentinel.mil");
  const [password, setPassword] = useState("Sentinel2026!");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email, password); nav("/"); }
    catch (ex) { setErr(formatApiError(ex.response?.data?.detail) || ex.message); }
    finally { setBusy(false); }
  };

  const preset = (role) => {
    if (role === "admin") { setEmail("admin@sentinel.mil"); setPassword("Sentinel2026!"); }
    if (role === "analyst") { setEmail("analyst@sentinel.mil"); setPassword("Analyst2026!"); }
    if (role === "viewer") { setEmail("viewer@sentinel.mil"); setPassword("Viewer2026!"); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050914] relative overflow-hidden">
      <div className="classified-stripe h-6 text-black font-mono text-[11px] font-bold flex items-center justify-center tracking-[0.3em] uppercase">
        UNCLASSIFIED // NOTIONAL DATA
      </div>
      <div className="absolute inset-0 grid-overlay opacity-40 pointer-events-none"></div>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, rgba(0,240,255,0.08), transparent 60%)"
      }}></div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md glass corner-brackets p-8 relative">
          <div className="cb-b"></div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 border border-cyan-400/60 flex items-center justify-center glow-cyan">
              <Radio className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-[0.25em] text-cyan-100">SENTINEL</div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/70">OSINT INTELLIGENCE PLATFORM</div>
            </div>
          </div>

          <div className="mb-4 text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>AUTHORIZED ACCESS ONLY · ACTIVITY LOGGED</span>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-400/70 mb-1.5">Operator ID</label>
              <div className="relative">
                <User className="w-4 h-4 text-cyan-400/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  data-testid="login-email"
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="tactical-input w-full pl-10"
                  placeholder="operator@sentinel.mil"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-400/70 mb-1.5">Credential</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-cyan-400/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  data-testid="login-password"
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="tactical-input w-full pl-10"
                  placeholder="••••••••••"
                />
              </div>
            </div>

            {err && <div data-testid="login-error" className="text-critical text-xs font-mono border border-critical/40 bg-critical/10 p-2">{err}</div>}

            <button
              data-testid="login-submit"
              disabled={busy} type="submit"
              className="btn-tactical w-full disabled:opacity-50"
            >
              {busy ? "AUTHENTICATING..." : "INITIATE SESSION"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-cyan-400/15">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-400/70 mb-2">Quick Access · Demo</div>
            <div className="grid grid-cols-3 gap-2">
              {["admin", "analyst", "viewer"].map(r => (
                <button
                  key={r} type="button" onClick={() => preset(r)} data-testid={`preset-${r}`}
                  className="border border-cyan-400/20 bg-cyan-400/5 hover:bg-cyan-400/15 text-cyan-200 text-[11px] font-mono uppercase tracking-widest py-2 transition"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
