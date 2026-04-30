import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Search, UserCircle2, AlertTriangle, Shield, Tag, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function OSINT() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: "", aliases: "", phone: "", email: "", nationality: "", affiliations: "", notes: "", risk_score: 50, tags: "" });

  const load = async (query = "") => {
    const r = await api.get(`/osint/people${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setPeople(r.data);
    if (!selected && r.data[0]) pick(r.data[0]);
  };

  const pick = async (p) => {
    setSelected(p);
    const r = await api.get(`/osint/people/${p.id}`);
    setDetail(r.data);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      full_name: form.full_name,
      aliases: form.aliases.split(",").map(s => s.trim()).filter(Boolean),
      phone: form.phone || null,
      email: form.email || null,
      nationality: form.nationality || null,
      affiliations: form.affiliations.split(",").map(s => s.trim()).filter(Boolean),
      notes: form.notes,
      risk_score: Number(form.risk_score) || 0,
      tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
    };
    await api.post("/osint/people", payload);
    setShowAdd(false);
    setForm({ full_name: "", aliases: "", phone: "", email: "", nationality: "", affiliations: "", notes: "", risk_score: 50, tags: "" });
    load();
  };

  const canEdit = ["admin", "analyst"].includes(user?.role);

  const riskBand = (r) => r >= 80 ? { text: "CRITICAL", c: "text-critical border-critical/50" }
    : r >= 60 ? { text: "HIGH", c: "text-[#FF6B35] border-[#FF6B35]/50" }
    : r >= 30 ? { text: "MED", c: "text-warn border-warn/50" }
    : { text: "LOW", c: "text-emerald-400 border-emerald-400/50" };

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>

        <div className="glass p-3 flex items-center gap-3 z-10">
          <UserCircle2 className="w-4 h-4 text-cyan-300" />
          <span className="font-display tracking-widest text-sm text-slate-200">OSINT · PERSON OF INTEREST</span>
          <div className="flex-1 max-w-md ml-4 relative">
            <Search className="w-3.5 h-3.5 text-cyan-400/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              data-testid="osint-search"
              value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load(q)}
              placeholder="name · alias · phone · email · tag"
              className="tactical-input w-full pl-9"
            />
          </div>
          <button data-testid="osint-search-btn" onClick={() => load(q)} className="btn-tactical text-[11px] py-1.5">Query</button>
          {canEdit && (
            <button data-testid="add-person-btn" onClick={() => setShowAdd(true)} className="btn-tactical text-[11px] py-1.5 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />Add POI
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 z-10">
          <div className="col-span-5 glass overflow-hidden flex flex-col" data-testid="osint-list">
            <div className="px-3 py-2 border-b border-cyan-400/20 font-mono text-[10px] uppercase tracking-widest text-slate-500 flex">
              <span className="flex-1">Subject</span>
              <span className="w-16">Risk</span>
              <span className="w-24">Tags</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {people.map(p => {
                const band = riskBand(p.risk_score);
                return (
                  <button key={p.id} data-testid={`person-${p.id}`} onClick={() => pick(p)}
                    className={`w-full text-left px-3 py-2.5 border-b border-cyan-400/5 hover:bg-cyan-400/5 transition ${selected?.id === p.id ? "bg-cyan-400/10 border-l-2 border-l-cyan-400" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-100 text-sm truncate font-display tracking-wide">{p.full_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {p.nationality || "—"} · {p.affiliations?.slice(0, 2).join(", ") || "no affiliation"}
                        </div>
                      </div>
                      <span className={`font-mono text-[9px] px-2 py-1 border uppercase tracking-widest ${band.c}`}>{p.risk_score} {band.text}</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.tags?.slice(0, 4).map(t => (
                        <span key={t} className="font-mono text-[9px] uppercase bg-slate-800/60 text-slate-400 px-1.5 py-0.5 border border-slate-700">{t}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
              {people.length === 0 && <div className="p-8 text-center text-slate-500 text-sm font-mono">No results</div>}
            </div>
          </div>

          <div className="col-span-7 glass p-5 overflow-y-auto" data-testid="person-detail">
            {detail?.person ? (
              <>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 border border-cyan-400/40 bg-cyan-400/5 flex items-center justify-center">
                    <UserCircle2 className="w-12 h-12 text-cyan-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Subject Profile</div>
                    <div className="font-display text-2xl text-slate-100">{detail.person.full_name}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                      {detail.person.nationality && <span>NAT: <span className="text-slate-300">{detail.person.nationality}</span>  ·  </span>}
                      Aliases: <span className="text-slate-300">{detail.person.aliases?.join(", ") || "none"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Risk Score</div>
                    <div className={`font-display text-4xl ${riskBand(detail.person.risk_score).c.split(" ")[0]}`}>{detail.person.risk_score}</div>
                    <div className={`text-[10px] font-mono uppercase tracking-widest inline-block px-2 py-0.5 border ${riskBand(detail.person.risk_score).c}`}>{riskBand(detail.person.risk_score).text}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    ["Phone", detail.person.phone || "—"],
                    ["Email", detail.person.email || "—"],
                    ["Affiliations", detail.person.affiliations?.join(", ") || "—"],
                    ["Tags", detail.person.tags?.join(", ") || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="border border-cyan-400/15 p-2.5 bg-black/30">
                      <div className="text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
                      <div className="text-slate-200 mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Intelligence Notes</div>
                  <div className="border-l-2 border-cyan-400/40 pl-3 text-sm text-slate-300 bg-slate-900/30 py-2">
                    {detail.person.notes || "No intelligence on file."}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Known Relationships ({detail.relationships?.length || 0})</div>
                  {detail.relationships?.length ? (
                    <div className="space-y-1.5">
                      {detail.relationships.map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-[11px] font-mono border border-cyan-400/15 px-2 py-1.5 bg-black/30">
                          <span className="text-slate-500">{r.source_id === detail.person.id ? "→" : "←"}</span>
                          <span className="text-cyan-300">{r.relation}</span>
                          <span className="ml-auto text-slate-400">strength {r.strength}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-slate-500 text-[11px] font-mono">No relationships indexed.</div>}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm">Select a subject from the list</div>
            )}
          </div>
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <form onClick={e => e.stopPropagation()} onSubmit={submit} className="glass-strong corner-brackets w-full max-w-lg p-6 space-y-3 relative" data-testid="add-person-modal">
              <div className="cb-b"></div>
              <div className="font-display text-xl text-cyan-100 tracking-widest">ADD PERSON OF INTEREST</div>
              {[
                ["full_name", "Full Name", true],
                ["aliases", "Aliases (comma sep)", false],
                ["phone", "Phone", false],
                ["email", "Email", false],
                ["nationality", "Nationality (ISO2)", false],
                ["affiliations", "Affiliations (comma sep)", false],
                ["tags", "Tags (comma sep)", false],
              ].map(([k, label, req]) => (
                <div key={k}>
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">{label}</label>
                  <input data-testid={`add-${k}`} required={req} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="tactical-input w-full" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Risk Score · {form.risk_score}</label>
                <input data-testid="add-risk" type="range" min="0" max="100" value={form.risk_score} onChange={e => setForm({ ...form, risk_score: e.target.value })} className="w-full accent-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Notes</label>
                <textarea data-testid="add-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="tactical-input w-full h-20 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 btn-tactical btn-tactical-danger">Cancel</button>
                <button type="submit" data-testid="add-person-submit" className="flex-1 btn-tactical">Commit</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
