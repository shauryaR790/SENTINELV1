import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { ShieldCheck } from "lucide-react";

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get("/audit").then(r => setLogs(r.data)).catch(e => setErr("Access denied (admin only)"));
  }, []);
  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>
        <div className="glass p-3 flex items-center gap-3 z-10">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="font-display tracking-widest text-sm text-slate-200">AUDIT LOG · SECURITY TRAIL</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">ADMIN ACCESS</span>
        </div>
        <div className="glass flex-1 overflow-y-auto z-10" data-testid="audit-log">
          {err ? <div className="p-8 text-center text-critical font-mono">{err}</div> : (
            <table className="w-full text-[11px] font-mono">
              <thead className="sticky top-0 bg-[#050914] border-b border-cyan-400/20">
                <tr className="text-slate-500 uppercase tracking-widest text-[9px]">
                  <th className="text-left px-3 py-2">Timestamp</th>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-cyan-400/5 hover:bg-cyan-400/5">
                    <td className="px-3 py-1.5 text-cyan-300">{l.ts?.slice(0, 19).replace("T", " ")}</td>
                    <td className="px-3 py-1.5 text-slate-200">{l.email}</td>
                    <td className="px-3 py-1.5 uppercase text-amber-400">{l.role}</td>
                    <td className="px-3 py-1.5 text-slate-300">{l.action}</td>
                    <td className="px-3 py-1.5 text-slate-500">{l.target || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
