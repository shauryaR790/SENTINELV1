import React, { useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { SearchCode, Brain, MapPin, Users, Target, Loader2 } from "lucide-react";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("full"); // full | nl
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [nlResult, setNlResult] = useState(null);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true); setResults(null); setNlResult(null);
    try {
      if (mode === "full") {
        const r = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(r.data);
      } else {
        const r = await api.post("/ai/nl-query", { query: q });
        setNlResult(r.data);
      }
    } catch (e) {}
    setBusy(false);
  };

  const examples = [
    "people connected to IRGC",
    "critical events in Ukraine last 24h",
    "cyber attacks near London",
    "high severity maritime incidents",
  ];

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 overflow-y-auto relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>

        <div className="glass p-5 z-10">
          <div className="flex items-center gap-2 mb-3">
            <SearchCode className="w-4 h-4 text-cyan-300" />
            <span className="font-display tracking-widest text-sm text-slate-200">ADVANCED SEARCH · SEMANTIC + STRUCTURED</span>
          </div>
          <div className="flex gap-2">
            <button data-testid="mode-full" onClick={() => setMode("full")} className={`px-4 py-2 font-mono text-[11px] uppercase tracking-widest border ${mode === "full" ? "border-cyan-400 bg-cyan-400/15 text-cyan-300" : "border-slate-700 text-slate-400"}`}>Full-Text</button>
            <button data-testid="mode-nl" onClick={() => setMode("nl")} className={`px-4 py-2 font-mono text-[11px] uppercase tracking-widest border flex items-center gap-1 ${mode === "nl" ? "border-cyan-400 bg-cyan-400/15 text-cyan-300" : "border-slate-700 text-slate-400"}`}>
              <Brain className="w-3.5 h-3.5" />Natural Language · AI
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              data-testid="search-input"
              value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && run()}
              placeholder={mode === "nl" ? 'e.g. "show critical events in middle east last 24h"' : "keyword · name · country"}
              className="tactical-input flex-1"
            />
            <button data-testid="search-run" onClick={run} disabled={busy} className="btn-tactical flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Execute
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {examples.map((x, i) => (
              <button key={i} onClick={() => { setQ(x); setMode("nl"); }} className="text-[10px] font-mono px-2 py-1 border border-cyan-400/20 text-slate-400 hover:text-cyan-300 hover:border-cyan-400/60">
                {x}
              </button>
            ))}
          </div>
        </div>

        {busy && (
          <div className="glass p-8 text-center font-mono text-cyan-300 z-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {mode === "nl" ? "CLAUDE 4.5 PARSING QUERY…" : "SEARCHING INDEX…"}
          </div>
        )}

        {nlResult && (
          <>
            <div className="glass p-4 z-10">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Parsed Filter</div>
              <div className="grid grid-cols-5 gap-2 text-[11px] font-mono">
                {[
                  ["Region", nlResult.filter?.region || "—"],
                  ["Severity", nlResult.filter?.severity || "—"],
                  ["Category", nlResult.filter?.category || "—"],
                  ["Hours", nlResult.filter?.hours || "—"],
                  ["Keywords", (nlResult.filter?.keywords || []).join(", ") || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="border border-cyan-400/20 p-2 bg-black/30">
                    <div className="text-slate-500 uppercase text-[9px]">{k}</div>
                    <div className="text-cyan-300 mt-0.5 truncate">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] font-mono text-slate-400">Matched <span className="text-cyan-300">{nlResult.count}</span> events</div>
            </div>
            <div className="glass z-10" data-testid="nl-results">
              {(nlResult.events || []).map(e => (
                <div key={e.id} className="p-3 border-b border-cyan-400/10 hover:bg-cyan-400/5 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full blink-dot" style={{ background: e.severity === "critical" ? "#FF2A2A" : "#FFB800" }}></span>
                  <div className="flex-1">
                    <div className="text-slate-100 text-sm">{e.title}</div>
                    <div className="font-mono text-[10px] text-slate-500">{e.country} · {e.category} · {e.severity}</div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{new Date(e.ts).toLocaleString()}</span>
                </div>
              ))}
              {(nlResult.events || []).length === 0 && <div className="p-8 text-center text-slate-500 font-mono text-sm">No events matched the AI-parsed filter.</div>}
            </div>
          </>
        )}

        {results && (
          <div className="grid grid-cols-3 gap-3 z-10" data-testid="search-results">
            {[
              { title: "Events", icon: Target, items: results.events, render: e => <><div className="text-slate-100 text-sm">{e.title}</div><div className="font-mono text-[10px] text-slate-500">{e.country} · {e.severity}</div></> },
              { title: "People", icon: Users, items: results.people, render: p => <><div className="text-slate-100 text-sm">{p.full_name}</div><div className="font-mono text-[10px] text-slate-500">{p.nationality} · risk {p.risk_score}</div></> },
              { title: "Missions", icon: MapPin, items: results.missions, render: m => <><div className="text-slate-100 text-sm">{m.title}</div><div className="font-mono text-[10px] text-slate-500">{m.status} · {m.severity}</div></> },
            ].map((bucket, i) => (
              <div key={i} className="glass overflow-hidden flex flex-col">
                <div className="px-3 py-2 border-b border-cyan-400/20 flex items-center gap-2">
                  <bucket.icon className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="font-display tracking-widest text-xs text-slate-200">{bucket.title}</span>
                  <span className="ml-auto font-mono text-[10px] text-cyan-300">{bucket.items?.length || 0}</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-96">
                  {bucket.items?.length ? bucket.items.map((x, j) => (
                    <div key={j} className="p-3 border-b border-cyan-400/10 hover:bg-cyan-400/5">{bucket.render(x)}</div>
                  )) : <div className="p-8 text-center text-slate-500 font-mono text-xs">No matches</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
