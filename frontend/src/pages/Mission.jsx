import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Target, Check, X, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Mission() {
  const { user } = useAuth();
  const [missions, setMissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", total_hours: 6 });

  const load = () => api.get("/missions").then(r => { setMissions(r.data); if (!selected && r.data[0]) setSelected(r.data[0]); });
  useEffect(() => { load(); }, []);

  const canEdit = ["admin", "analyst"].includes(user?.role);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title, description: form.description, severity: form.severity,
      total_hours: Number(form.total_hours),
      assets: [{ type: "C-130", qty: 2, location: "Aarons AFB", status: "8 FMC" }],
      steps: [
        { name: "Mobilize", start: 0, duration: 1 },
        { name: "Transit", start: 1, duration: Number(form.total_hours) - 2 },
        { name: "Execute", start: Number(form.total_hours) - 1, duration: 1 },
      ],
    };
    await api.post("/missions", payload);
    setShowAdd(false);
    setForm({ title: "", description: "", severity: "medium", total_hours: 6 });
    load();
  };

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>

        <div className="glass p-3 flex items-center gap-3 z-10">
          <Target className="w-4 h-4 text-cyan-300" />
          <span className="font-display tracking-widest text-sm text-slate-200">MISSION CONTROL · SCENARIO SIMULATION</span>
          {canEdit && (
            <button onClick={() => setShowAdd(true)} data-testid="new-mission-btn" className="ml-auto btn-tactical text-[11px] py-1.5 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />New Scenario
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 z-10">
          <div className="col-span-4 glass overflow-hidden flex flex-col" data-testid="mission-list">
            <div className="px-3 py-2 border-b border-cyan-400/20 font-mono text-[10px] uppercase tracking-widest text-slate-500">Scenarios</div>
            <div className="flex-1 overflow-y-auto">
              {missions.map(m => (
                <button key={m.id} onClick={() => setSelected(m)}
                  data-testid={`mission-${m.id}`}
                  className={`w-full text-left p-3 border-b border-cyan-400/10 hover:bg-cyan-400/5 transition ${selected?.id === m.id ? "bg-cyan-400/10 border-l-2 border-l-cyan-400" : ""}`}>
                  <div className="text-slate-100 font-medium text-sm">{m.title}</div>
                  <div className="flex items-center gap-2 mt-1 font-mono text-[10px]">
                    <span className="text-amber-400 uppercase">{m.status}</span>
                    <span className="text-critical uppercase">{m.severity}</span>
                    <span className="text-slate-500">T+{m.total_hours}h</span>
                  </div>
                </button>
              ))}
              {missions.length === 0 && <div className="p-8 text-center text-slate-500 text-sm font-mono">No scenarios</div>}
            </div>
          </div>

          <div className="col-span-8 glass p-5 overflow-y-auto" data-testid="mission-detail">
            {selected ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Scenario</div>
                    <div className="font-display text-2xl text-slate-100 mt-1">{selected.title}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Status: <span className="text-amber-400">{selected.status?.toUpperCase()}</span> · Severity: <span className="text-critical">{selected.severity?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-tactical text-[11px] py-1.5 flex items-center gap-1 border-emerald-400/40 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"><Check className="w-3.5 h-3.5" />Approve</button>
                    <button className="btn-tactical-danger btn-tactical text-[11px] py-1.5 flex items-center gap-1"><X className="w-3.5 h-3.5" />Reject</button>
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-300 border-l-2 border-cyan-400/40 pl-3 py-1 bg-slate-900/30">{selected.description}</div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { l: "Total Time", v: `${selected.total_hours}h`, band: "LOW", sc: "text-emerald-400 border-emerald-400/40" },
                    { l: "Assets", v: `${(selected.assets || []).reduce((a, b) => a + (b.qty || 0), 0)}x`, band: "MED", sc: "text-warn border-warn/40" },
                    { l: "Steps", v: `${(selected.steps || []).length}`, band: "MED", sc: "text-warn border-warn/40" },
                  ].map((m, i) => (
                    <div key={i} className="border border-cyan-400/20 p-3 bg-black/40">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{m.l}</div>
                      <div className="font-display text-3xl text-cyan-300 mt-1">{m.v}</div>
                      <div className={`text-[10px] font-mono uppercase mt-1 px-1.5 inline-block border ${m.sc}`}>{m.band}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Resource Allocation · <span className="text-emerald-400">FEASIBLE</span></div>
                  <div className="grid grid-cols-2 gap-2">
                    {(selected.assets || []).map((a, i) => (
                      <div key={i} className="border border-cyan-400/20 p-3 bg-black/40 flex items-center gap-3">
                        <div className="w-10 h-10 border border-cyan-400/40 bg-cyan-400/5 flex items-center justify-center text-cyan-300 font-mono">{a.qty}x</div>
                        <div className="flex-1">
                          <div className="text-slate-100 font-display tracking-wide">{a.type}</div>
                          <div className="font-mono text-[10px] text-slate-500">{a.location} · {a.status}</div>
                        </div>
                        <span className="text-emerald-400 text-[10px] font-mono">✓</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Execution Timeline</div>
                  <div className="relative h-24 border border-cyan-400/15 bg-black/30 p-2">
                    <div className="absolute inset-2 flex">
                      {Array.from({ length: Math.ceil(selected.total_hours + 2) }, (_, i) => (
                        <div key={i} className="flex-1 border-r border-cyan-400/10 text-[9px] font-mono text-slate-600 pl-1">{i}h</div>
                      ))}
                    </div>
                    {(selected.steps || []).map((s, i) => {
                      const total = Math.max(selected.total_hours, 1);
                      const left = (s.start / total) * 100;
                      const width = (s.duration / total) * 100;
                      return (
                        <div key={i}
                          style={{ left: `${left}%`, width: `${width}%`, top: `${10 + (i % 3) * 18}px` }}
                          className="absolute h-5 border border-cyan-400/50 bg-cyan-400/15 text-cyan-100 text-[10px] font-mono px-2 flex items-center overflow-hidden hover:bg-cyan-400/30 transition">
                          {s.name}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 border border-amber-400/30 bg-amber-400/5 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1">Risk Probability Engine</div>
                  <div className="font-display text-2xl text-amber-300">62% SUCCESS</div>
                  <div className="text-[11px] text-slate-300 mt-1 font-mono">Monte-Carlo simulated over 10k iterations · Primary risks: air corridor saturation, ground threat posture.</div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm">Select a scenario</div>
            )}
          </div>
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <form onClick={e => e.stopPropagation()} onSubmit={submit} className="glass-strong corner-brackets w-full max-w-lg p-6 space-y-3 relative" data-testid="new-mission-modal">
              <div className="cb-b"></div>
              <div className="font-display text-xl tracking-widest text-cyan-100">NEW SCENARIO</div>
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Title</label>
                <input data-testid="mission-title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="tactical-input w-full" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="tactical-input w-full h-20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Severity</label>
                  <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="tactical-input w-full">
                    <option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option><option value="critical">CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Total Hours</label>
                  <input type="number" step="0.5" min="1" value={form.total_hours} onChange={e => setForm({ ...form, total_hours: e.target.value })} className="tactical-input w-full" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 btn-tactical btn-tactical-danger">Cancel</button>
                <button type="submit" data-testid="mission-submit" className="flex-1 btn-tactical">Create</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
