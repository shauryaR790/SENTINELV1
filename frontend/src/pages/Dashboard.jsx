import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Globe3D from "../components/Globe3D";
import { api } from "../lib/api";
import { AlertTriangle, Activity, ChevronRight, ChevronLeft, Clock, MapPin, Target, Check, X, MessageSquare } from "lucide-react";

const SEVERITY_CLASS = {
  critical: "border-l-critical text-critical",
  high: "border-l-[#FF6B35] text-[#FF6B35]",
  medium: "border-l-warn text-warn",
  low: "border-l-cyan_s text-cyan-300",
};

function formatAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [ships, setShips] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mission, setMission] = useState(null);
  const [tab, setTab] = useState("situations");
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    api.get("/events?limit=50").then(r => {
      setEvents(r.data);
      if (r.data[0]) setSelectedEvent(r.data[0]);
    });
    api.get("/missions").then(r => setMission(r.data[0]));
    api.get("/aircraft/live").then(r => setAircraft(r.data.aircraft || []));
    api.get("/ships/live").then(r => setShips(r.data.ships || []));
    api.get("/ai/insights").then(r => setInsights(r.data.insights || [])).catch(() => {});

    const t1 = setInterval(() => api.get("/aircraft/live").then(r => setAircraft(r.data.aircraft || [])), 20000);
    const t2 = setInterval(() => api.get("/ships/live").then(r => setShips(r.data.ships || [])), 15000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const arcs = mission?.steps ? [
    { startLat: 39.3, startLng: -76.6, endLat: 43.78, endLng: 20.5 }, // Aarons to Zlarovo
    { startLat: 50.1, startLng: 8.6, endLat: 43.78, endLng: 20.5 },    // Germany to Zlarovo
  ] : [];

  return (
    <Layout>
      <div className="w-full h-full grid grid-cols-12 grid-rows-[1fr_auto] gap-2 p-2 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-60"></div>

        {/* Left: Situations */}
        <aside className="col-span-3 row-span-1 flex flex-col gap-2 min-h-0 z-10" data-testid="left-panel">
          <div className="glass p-0 flex flex-col h-full">
            <div className="flex border-b border-cyan-400/20 text-[11px] font-mono uppercase tracking-widest">
              {["situations", "ops", "data"].map(t => (
                <button
                  key={t}
                  data-testid={`tab-${t}`}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-2.5 transition ${tab === t ? "text-cyan-300 bg-cyan-400/10 border-b-2 border-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "situations" && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 border-b border-cyan-400/10 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-critical" />
                  <span className="font-display tracking-widest text-sm text-slate-200">ACTIVE SITUATIONS</span>
                  <span className="ml-auto font-mono text-[10px] text-cyan-400/70">{events.length}</span>
                </div>
                <div>
                  {events.map(e => (
                    <button
                      key={e.id}
                      data-testid={`situation-${e.id}`}
                      onClick={() => setSelectedEvent(e)}
                      className={`w-full text-left border-l-2 border-y border-y-slate-800/60 border-r border-r-slate-800/60 px-3 py-2.5 transition hover:bg-cyan-400/5 ${SEVERITY_CLASS[e.severity] || ""} ${selectedEvent?.id === e.id ? "bg-cyan-400/10" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 blink-dot`} style={{ background: e.severity === "critical" ? "#FF2A2A" : e.severity === "high" ? "#FF6B35" : e.severity === "medium" ? "#FFB800" : "#00F0FF" }}></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-slate-100 font-medium truncate">{e.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500">
                            <MapPin className="w-3 h-3" />{e.country || "UNKNOWN"}
                            <Clock className="w-3 h-3 ml-1" />{formatAgo(e.ts)}
                          </div>
                        </div>
                        <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${SEVERITY_CLASS[e.severity]?.replace("text-", "text-").replace("border-l-", "border-") || "border-slate-700 text-slate-400"}`}>{e.severity}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tab === "ops" && (
              <div className="p-3 text-[12px] text-slate-400 font-mono space-y-2">
                <div className="text-cyan-300 font-display tracking-widest">OPERATIONS</div>
                {mission && (
                  <div className="border border-cyan-400/20 p-3">
                    <div className="text-slate-100">{mission.title}</div>
                    <div className="text-[10px] mt-1 text-slate-500">STATUS: {mission.status?.toUpperCase()}</div>
                    <div className="text-[10px] text-slate-500">SEV: <span className="text-critical">{mission.severity?.toUpperCase()}</span></div>
                    <div className="text-[10px] text-slate-500">T+{mission.total_hours}H</div>
                  </div>
                )}
              </div>
            )}
            {tab === "data" && (
              <div className="p-3 text-[12px] text-slate-400 font-mono space-y-2">
                <div className="text-cyan-300 font-display tracking-widest">DATA LAYERS</div>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-cyan-400" /> Events · {events.length}</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-cyan-400" /> Aircraft · {aircraft.length}</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-cyan-400" /> Ships · {ships.length}</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-cyan-400" /> Mission Arcs · {arcs.length}</label>
              </div>
            )}
          </div>
        </aside>

        {/* Center: Globe */}
        <section className="col-span-6 row-span-1 min-h-0 relative glass corner-brackets overflow-hidden" data-testid="center-stage">
          <div className="cb-b"></div>
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-1 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 tracking-widest">LIVE // GLOBAL</span>
            <span className="text-slate-500">ACTIVE CONTACTS</span>
            <span className="text-cyan-300">{events.length + aircraft.length + ships.length}</span>
          </div>
          <div className="absolute top-3 right-3 z-20 flex gap-1 text-[10px] font-mono">
            <span className="px-2 py-1 border border-critical/40 text-critical">● CRIT {events.filter(e => e.severity === "critical").length}</span>
            <span className="px-2 py-1 border border-[#FF6B35]/40 text-[#FF6B35]">● HIGH {events.filter(e => e.severity === "high").length}</span>
            <span className="px-2 py-1 border border-warn/40 text-warn">● MED {events.filter(e => e.severity === "medium").length}</span>
          </div>
          <Globe3D events={events} aircraft={aircraft} ships={ships} arcs={arcs} onEventClick={setSelectedEvent} />
        </section>

        {/* Right: COA / Event detail */}
        <aside className="col-span-3 row-span-1 flex flex-col gap-2 min-h-0 z-10" data-testid="right-panel">
          {selectedEvent && (
            <div className="glass p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest">Selected Situation</div>
                  <div className="font-display text-lg text-slate-100 mt-1">{selectedEvent.title}</div>
                </div>
                <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 border ${SEVERITY_CLASS[selectedEvent.severity] || "border-slate-700 text-slate-400"}`}>{selectedEvent.severity}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="border border-cyan-400/20 p-2">
                  <div className="text-slate-500 uppercase">Country</div>
                  <div className="text-slate-100">{selectedEvent.country || "UNKNOWN"}</div>
                </div>
                <div className="border border-cyan-400/20 p-2">
                  <div className="text-slate-500 uppercase">Source</div>
                  <div className="text-slate-100">{selectedEvent.source}</div>
                </div>
                <div className="border border-cyan-400/20 p-2">
                  <div className="text-slate-500 uppercase">Reliability</div>
                  <div className="text-cyan-300">{selectedEvent.reliability}%</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-300 leading-relaxed">{selectedEvent.description}</div>
            </div>
          )}

          {mission && (
            <div className="glass p-4 flex-1 overflow-y-auto" data-testid="coa-panel">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest">Course of Action</div>
                  <div className="font-display text-lg text-slate-100 mt-1">{mission.title}</div>
                  <div className="text-[10px] font-mono text-slate-500">Status: <span className="text-amber-400">{mission.status?.toUpperCase()}</span></div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 font-mono text-[11px] uppercase tracking-widest py-1.5 flex items-center justify-center gap-1" data-testid="coa-approve"><Check className="w-3.5 h-3.5" />Approve</button>
                <button className="flex-1 border border-critical/40 text-critical hover:bg-critical/10 font-mono text-[11px] uppercase tracking-widest py-1.5 flex items-center justify-center gap-1" data-testid="coa-reject"><X className="w-3.5 h-3.5" />Reject</button>
                <button className="flex-1 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 font-mono text-[11px] uppercase tracking-widest py-1.5 flex items-center justify-center gap-1"><MessageSquare className="w-3.5 h-3.5" />Note</button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Total Time", value: `${mission.total_hours}h`, s: "LOW", sc: "text-emerald-400 border-emerald-400/40" },
                  { label: "Assets", value: `${(mission.assets || []).reduce((a, b) => a + (b.qty || 0), 0)}x`, s: "MED", sc: "text-warn border-warn/40" },
                  { label: "Steps", value: `${(mission.steps || []).length}`, s: "MED", sc: "text-warn border-warn/40" },
                ].map((m, i) => (
                  <div key={i} className="border border-cyan-400/20 p-2.5 bg-black/40">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{m.label}</div>
                    <div className="font-display text-xl text-cyan-300 mt-0.5">{m.value}</div>
                    <div className={`text-[9px] font-mono uppercase mt-1 px-1 inline-block border ${m.sc}`}>{m.s}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest mb-2">Requirements · <span className="text-emerald-400">FEASIBLE</span></div>
                <div className="space-y-1.5">
                  {(mission.assets || []).map((a, i) => (
                    <div key={i} className="flex items-center justify-between border border-cyan-400/15 px-2 py-1.5 bg-black/30 text-[11px] font-mono">
                      <span className="text-slate-200">{a.qty}x {a.type}</span>
                      <span className="text-emerald-400 text-[10px]">✓ {a.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest mb-2">AI Insights</div>
                <div className="space-y-1.5">
                  {(insights.length ? insights : ["Loading analysis…"]).map((x, i) => (
                    <div key={i} className="text-[11px] text-slate-300 border-l-2 border-cyan-400/40 pl-2 py-1">
                      {x}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Bottom timeline */}
        <div className="col-span-12 glass p-3 h-28 relative sweep-line" data-testid="timeline">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-display tracking-widest text-xs text-slate-300">MISSION TIMELINE</span>
            <span className="font-mono text-[10px] text-slate-500">T-0 → T+13H</span>
            <span className="ml-auto font-mono text-[10px] text-cyan-300">NOW · {mission?.total_hours ? `T+${(mission.steps || []).find(s => s)?.start || 0}h` : "—"}</span>
          </div>
          <div className="relative h-14">
            <div className="absolute inset-0 flex">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="flex-1 border-r border-cyan-400/10 text-[9px] font-mono text-slate-600 pl-1">{i}</div>
              ))}
            </div>
            {mission?.steps?.map((s, i) => {
              const total = 13;
              const left = (s.start / total) * 100;
              const width = (s.duration / total) * 100;
              return (
                <div key={i}
                  className="absolute h-6 border border-cyan-400/50 bg-cyan-400/10 text-cyan-100 text-[10px] font-mono px-2 flex items-center overflow-hidden hover:bg-cyan-400/25 transition"
                  style={{ left: `${left}%`, width: `${width}%`, top: `${8 + (i % 3) * 14}px` }}
                  data-testid={`timeline-step-${i}`}
                >
                  {s.name}
                </div>
              );
            })}
            <div className="absolute top-0 bottom-0 border-l-2 border-critical" style={{ left: "23%" }}>
              <div className="absolute -top-0.5 -left-1 w-2 h-2 bg-critical rounded-full blink-dot"></div>
              <div className="absolute -bottom-4 -left-3 text-[9px] font-mono text-critical">NOW</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
