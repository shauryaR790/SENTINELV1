import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Activity, Brain, TrendingUp, AlertTriangle, Users, FileStack } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Analytics() {
  const [kpis, setKpis] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);

  useEffect(() => {
    api.get("/analytics/kpis").then(r => setKpis(r.data));
    api.get("/ai/insights").then(r => { setInsights(r.data.insights || []); setLoadingAI(false); }).catch(() => setLoadingAI(false));
  }, []);

  const Tile = ({ icon: Icon, label, value, accent = "cyan", testid }) => (
    <div className="glass p-4 relative overflow-hidden sweep-line" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
          <div className={`font-display text-3xl mt-1 ${accent === "red" ? "text-critical" : accent === "amber" ? "text-warn" : "text-cyan-300"}`}>
            {value ?? "—"}
          </div>
        </div>
        <Icon className={`w-5 h-5 ${accent === "red" ? "text-critical" : accent === "amber" ? "text-warn" : "text-cyan-300"}`} />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 overflow-y-auto relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>

        <div className="glass p-3 flex items-center gap-3 z-10">
          <Activity className="w-4 h-4 text-cyan-300" />
          <span className="font-display tracking-widest text-sm text-slate-200">ANALYTICS &amp; INSIGHTS</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">LIVE · REFRESHED {new Date().toLocaleTimeString()}</span>
        </div>

        <div className="grid grid-cols-6 gap-3 z-10">
          <Tile icon={AlertTriangle} label="Active Threats" value={kpis?.active_threats} accent="red" testid="kpi-active-threats" />
          <Tile icon={Users} label="People Tracked" value={kpis?.people_tracked} testid="kpi-people" />
          <Tile icon={TrendingUp} label="High-Risk POI" value={kpis?.high_risk_people} accent="amber" testid="kpi-high-risk" />
          <Tile icon={Activity} label="Active Missions" value={kpis?.active_missions} testid="kpi-missions" />
          <Tile icon={FileStack} label="Docs Ingested" value={kpis?.documents_ingested} testid="kpi-docs" />
          <Tile icon={AlertTriangle} label="Instability Idx" value={kpis?.instability_index} accent="red" testid="kpi-instability" />
        </div>

        <div className="grid grid-cols-12 gap-3 z-10">
          <div className="col-span-8 glass p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70">Time Series</div>
                <div className="font-display text-lg tracking-widest text-slate-200">EVENT VOLUME · 14D</div>
              </div>
            </div>
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={kpis?.timeseries || []}>
                  <CartesianGrid stroke="rgba(0,240,255,0.08)" strokeDasharray="2 4" />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
                  <YAxis stroke="#64748B" tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#050914", border: "1px solid #00F0FF40", fontFamily: "JetBrains Mono" }} />
                  <Line type="monotone" dataKey="events" stroke="#00F0FF" strokeWidth={2} dot={{ fill: "#00F0FF", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-4 glass p-4" data-testid="ai-insights">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-cyan-300" />
              <div className="font-display tracking-widest text-sm text-slate-200">AI THREAT INSIGHTS</div>
              <span className="ml-auto font-mono text-[9px] text-cyan-400/70">CLAUDE 4.5</span>
            </div>
            {loadingAI ? (
              <div className="font-mono text-[11px] text-slate-500">Analyzing global patterns…</div>
            ) : insights.length ? (
              <div className="space-y-2">
                {insights.map((x, i) => (
                  <div key={i} className="text-[12px] text-slate-300 border-l-2 border-cyan-400 pl-2.5 py-1.5 bg-cyan-400/5">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/70 mb-0.5">Insight #{i + 1}</div>
                    {x}
                  </div>
                ))}
              </div>
            ) : <div className="font-mono text-[11px] text-slate-500">No insights available.</div>}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 z-10">
          <div className="col-span-12 glass p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70 mb-1">Regional Distribution</div>
            <div className="font-display text-lg tracking-widest text-slate-200 mb-3">EVENTS BY COUNTRY</div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={kpis?.regions || []}>
                  <CartesianGrid stroke="rgba(0,240,255,0.08)" strokeDasharray="2 4" />
                  <XAxis dataKey="name" stroke="#64748B" tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
                  <YAxis stroke="#64748B" tick={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#050914", border: "1px solid #00F0FF40", fontFamily: "JetBrains Mono" }} />
                  <Bar dataKey="value" fill="#00F0FF" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
