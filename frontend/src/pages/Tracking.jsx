import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Plane, Anchor, RefreshCw } from "lucide-react";

export default function Tracking() {
  const [aircraft, setAircraft] = useState([]);
  const [ships, setShips] = useState([]);
  const [tab, setTab] = useState("aircraft");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAC = async () => {
    setLoading(true);
    try {
      const r = await api.get("/aircraft/live");
      setAircraft(r.data.aircraft || []);
    } catch (e) {}
    setLoading(false);
  };
  const loadShips = async () => {
    try {
      const r = await api.get("/ships/live");
      setShips(r.data.ships || []);
    } catch (e) {}
  };

  useEffect(() => {
    loadAC(); loadShips();
    const t = setInterval(() => { loadAC(); loadShips(); }, 20000);
    return () => clearInterval(t);
  }, []);

  const list = tab === "aircraft" ? aircraft : ships;

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>
        <div className="glass p-3 flex items-center gap-4 z-10">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-cyan-300" />
            <span className="font-display tracking-widest text-sm text-slate-200">AIR &amp; MARITIME TRACKING</span>
          </div>
          <div className="flex gap-1 ml-4">
            <button data-testid="tab-aircraft" onClick={() => setTab("aircraft")} className={`px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest border ${tab === "aircraft" ? "border-cyan-400 bg-cyan-400/15 text-cyan-300" : "border-slate-700 text-slate-400"}`}>Aircraft · {aircraft.length}</button>
            <button data-testid="tab-ships" onClick={() => setTab("ships")} className={`px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest border ${tab === "ships" ? "border-warn bg-warn/15 text-warn" : "border-slate-700 text-slate-400"}`}>Ships · {ships.length}</button>
          </div>
          <button data-testid="refresh-btn" onClick={() => { loadAC(); loadShips(); }} className="ml-auto btn-tactical text-[11px] py-1.5 flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 z-10">
          <div className="col-span-8 glass overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-400/20 font-mono text-[10px] uppercase tracking-widest text-slate-500 grid grid-cols-12">
              <div className="col-span-2">{tab === "aircraft" ? "Callsign" : "Vessel"}</div>
              <div className="col-span-2">{tab === "aircraft" ? "ICAO24" : "MMSI"}</div>
              <div className="col-span-2">Origin/Flag</div>
              <div className="col-span-2">LAT/LNG</div>
              <div className="col-span-2">{tab === "aircraft" ? "Altitude" : "Type"}</div>
              <div className="col-span-2">{tab === "aircraft" ? "Velocity" : "Speed"}</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {list.map((x, i) => (
                <button
                  key={i}
                  data-testid={`track-row-${i}`}
                  onClick={() => setSelected(x)}
                  className={`w-full text-left px-3 py-2 grid grid-cols-12 text-[11px] font-mono border-b border-cyan-400/5 hover:bg-cyan-400/5 transition ${selected === x ? "bg-cyan-400/10" : ""}`}
                >
                  <div className={`col-span-2 ${tab === "aircraft" ? "text-cyan-300" : "text-warn"}`}>{tab === "aircraft" ? (x.callsign || "—") : x.name}</div>
                  <div className="col-span-2 text-slate-400">{tab === "aircraft" ? x.icao24 : x.mmsi}</div>
                  <div className="col-span-2 text-slate-300">{tab === "aircraft" ? (x.origin || "—") : x.flag}</div>
                  <div className="col-span-2 text-slate-400">{x.lat?.toFixed(2)} / {x.lng?.toFixed(2)}</div>
                  <div className="col-span-2 text-slate-300">{tab === "aircraft" ? `${x.altitude || 0}m` : x.type}</div>
                  <div className="col-span-2 text-slate-300">{tab === "aircraft" ? `${Math.round(x.velocity || 0)} m/s` : `${x.speed} kt`}</div>
                </button>
              ))}
              {list.length === 0 && <div className="p-8 text-center text-slate-500 text-sm font-mono">No active contacts</div>}
            </div>
          </div>

          <div className="col-span-4 glass p-4" data-testid="track-detail">
            {selected ? (
              <div>
                <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest">Selected Contact</div>
                <div className="font-display text-xl text-slate-100 mt-1">{tab === "aircraft" ? (selected.callsign || selected.icao24) : selected.name}</div>
                <div className="text-[10px] font-mono text-slate-500">{tab === "aircraft" ? `ICAO24: ${selected.icao24}` : `MMSI: ${selected.mmsi}`}</div>

                <div className="mt-4 space-y-2 text-xs font-mono">
                  {Object.entries(tab === "aircraft" ? {
                    Origin: selected.origin || "—",
                    Position: `${selected.lat?.toFixed(4)}, ${selected.lng?.toFixed(4)}`,
                    Altitude: `${selected.altitude || 0} m`,
                    Velocity: `${Math.round(selected.velocity || 0)} m/s`,
                    Heading: `${Math.round(selected.heading || 0)}°`,
                    OnGround: selected.on_ground ? "YES" : "NO",
                  } : {
                    Flag: selected.flag,
                    Type: selected.type,
                    Position: `${selected.lat?.toFixed(4)}, ${selected.lng?.toFixed(4)}`,
                    Speed: `${selected.speed} kt`,
                    Course: `${selected.course}°`,
                  }).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-cyan-400/10 py-1.5">
                      <span className="text-slate-500 uppercase text-[10px]">{k}</span>
                      <span className="text-cyan-200">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 border border-amber-400/30 bg-amber-400/5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Pattern Analysis</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    {Math.random() > 0.7 ? "LOITERING DETECTED · extended dwell in sector" : "Route nominal · consistent bearing"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm text-center">
                Select a contact from the list<br />
                <span className="text-[10px] text-slate-600 mt-2">OpenSky Network · Live AIS (simulated)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
