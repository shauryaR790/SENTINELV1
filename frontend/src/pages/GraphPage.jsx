import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import ForceGraph2D from "react-force-graph-2d";
import { Share2, Filter } from "lucide-react";

const TYPE_COLOR = {
  person: "#00F0FF",
  organization: "#FFB800",
  location: "#00FF66",
  event: "#FF2A2A",
};

export default function GraphPage() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [filter, setFilter] = useState({ person: true, organization: true, location: true, event: true });
  const [selected, setSelected] = useState(null);
  const boxRef = useRef();
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    api.get("/graph").then(r => setData(r.data));
    const update = () => {
      if (!boxRef.current) return;
      const r = boxRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const filtered = {
    nodes: data.nodes.filter(n => filter[n.type]),
    links: data.links.filter(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      return data.nodes.find(n => n.id === src && filter[n.type]) && data.nodes.find(n => n.id === tgt && filter[n.type]);
    }),
  };

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>
        <div className="glass p-3 flex items-center gap-4 z-10">
          <Share2 className="w-4 h-4 text-cyan-300" />
          <span className="font-display tracking-widest text-sm text-slate-200">RELATIONSHIP GRAPH ENGINE</span>
          <div className="flex items-center gap-2 ml-6">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-mono uppercase text-slate-500">FILTER</span>
            {Object.keys(filter).map(k => (
              <button key={k} data-testid={`filter-${k}`}
                onClick={() => setFilter({ ...filter, [k]: !filter[k] })}
                className={`px-2 py-1 font-mono text-[10px] uppercase border tracking-widest ${filter[k] ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10" : "border-slate-700 text-slate-500"}`}
                style={filter[k] ? { color: TYPE_COLOR[k], borderColor: TYPE_COLOR[k] + "88" } : {}}
              >
                ● {k}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[11px] text-slate-400">
            <span className="text-cyan-300">{filtered.nodes.length}</span> nodes · <span className="text-cyan-300">{filtered.links.length}</span> edges
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 z-10">
          <div ref={boxRef} className="col-span-9 glass corner-brackets relative overflow-hidden" data-testid="graph-canvas">
            <div className="cb-b"></div>
            {dims.w > 0 && (
              <ForceGraph2D
                graphData={filtered}
                width={dims.w}
                height={dims.h}
                backgroundColor="rgba(0,0,0,0)"
                nodeLabel={n => `${n.label} (${n.type})`}
                nodeColor={n => TYPE_COLOR[n.type] || "#94A3B8"}
                nodeRelSize={6}
                linkColor={() => "rgba(0,240,255,0.25)"}
                linkWidth={1.2}
                linkDirectionalParticles={2}
                linkDirectionalParticleColor={() => "#00F0FF"}
                linkDirectionalParticleWidth={1.5}
                onNodeClick={(n) => setSelected(n)}
                nodeCanvasObject={(node, ctx, scale) => {
                  const label = node.label || "";
                  ctx.fillStyle = TYPE_COLOR[node.type] || "#94A3B8";
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                  ctx.fill();
                  ctx.shadowColor = TYPE_COLOR[node.type] || "#94A3B8";
                  ctx.shadowBlur = 10;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 3, 0, 2 * Math.PI, false);
                  ctx.fill();
                  ctx.shadowBlur = 0;

                  if (scale > 1.5) {
                    ctx.font = "10px JetBrains Mono";
                    ctx.fillStyle = "#CBD5E1";
                    ctx.textAlign = "center";
                    ctx.fillText(label.slice(0, 22), node.x, node.y + 14);
                  }
                }}
              />
            )}
          </div>

          <div className="col-span-3 glass p-4 overflow-y-auto" data-testid="graph-detail">
            {selected ? (
              <>
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Node</div>
                <div className="font-display text-lg text-slate-100 mt-1">{selected.label}</div>
                <div className="inline-block mt-1 text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 border" style={{ color: TYPE_COLOR[selected.type], borderColor: TYPE_COLOR[selected.type] + "88" }}>{selected.type}</div>
                {selected.risk != null && <div className="mt-3 text-xs font-mono text-slate-300">Risk: <span className="text-critical">{selected.risk}</span></div>}
                {selected.severity && <div className="mt-1 text-xs font-mono text-slate-300">Severity: <span className="text-critical">{selected.severity}</span></div>}
                <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Connections</div>
                <div className="space-y-1">
                  {filtered.links.filter(l => {
                    const s = typeof l.source === "object" ? l.source.id : l.source;
                    const t = typeof l.target === "object" ? l.target.id : l.target;
                    return s === selected.id || t === selected.id;
                  }).map((l, i) => {
                    const s = typeof l.source === "object" ? l.source : filtered.nodes.find(n => n.id === l.source);
                    const t = typeof l.target === "object" ? l.target : filtered.nodes.find(n => n.id === l.target);
                    const other = s?.id === selected.id ? t : s;
                    return (
                      <div key={i} className="text-[11px] font-mono border-l-2 border-cyan-400/40 pl-2 py-1 bg-slate-900/30">
                        <div className="text-slate-400">{l.relation}</div>
                        <div className="text-slate-200">{other?.label}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono text-center">
                Click any node to inspect<br /><span className="text-[10px] text-slate-600 mt-2">Force-directed graph · centrality-weighted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
