import React, { useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl";

/**
 * Interactive 3D globe with:
 * - Event points (severity colored)
 * - Heatmap rings on critical events
 * - Aircraft points (cyan)
 * - Ships (amber)
 * - Arcs for mission routes
 */
export default function Globe3D({
  events = [],
  aircraft = [],
  ships = [],
  arcs = [],
  onEventClick,
  height,
  width,
}) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [dims, setDims] = useState({ w: 600, h: 600 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enableZoom = true;
      }
      globeRef.current.pointOfView({ lat: 25, lng: 25, altitude: 2.2 }, 1500);
    }
  }, []);

  const sevColor = (s) => ({
    critical: "#FF2A2A",
    high: "#FF6B35",
    medium: "#FFB800",
    low: "#00F0FF",
  }[s] || "#94A3B8");

  const points = useMemo(() => {
    const ev = events.map(e => ({
      lat: e.lat, lng: e.lng, size: e.severity === "critical" ? 0.9 : e.severity === "high" ? 0.6 : 0.4,
      color: sevColor(e.severity), kind: "event", data: e,
    }));
    const ac = aircraft.map(a => ({
      lat: a.lat, lng: a.lng, size: 0.2, color: "#00F0FF", kind: "aircraft", data: a,
    }));
    const sh = ships.map(s => ({
      lat: s.lat, lng: s.lng, size: 0.25, color: "#FFB800", kind: "ship", data: s,
    }));
    return [...ev, ...ac, ...sh];
  }, [events, aircraft, ships]);

  const rings = useMemo(() => events.filter(e => ["critical", "high"].includes(e.severity)).map(e => ({
    lat: e.lat, lng: e.lng, maxR: e.severity === "critical" ? 5 : 3,
    propagationSpeed: 3, repeatPeriod: 1400, color: sevColor(e.severity)
  })), [events]);

  return (
    <div ref={containerRef} className="w-full h-full relative" data-testid="globe-3d">
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#00F0FF"
        atmosphereAltitude={0.22}
        showGraticules={true}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={d => d.kind === "event" ? 0.005 + (d.size || 0.3) * 0.02 : 0.002}
        pointRadius={d => (d.size || 0.3)}
        pointColor="color"
        pointLabel={d => {
          if (d.kind === "event") return `<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#F8FAFC;background:rgba(5,9,20,0.95);border:1px solid ${d.color};padding:6px 10px;"><b>${d.data.title}</b><br/>${d.data.country || ""} · ${d.data.severity?.toUpperCase()}</div>`;
          if (d.kind === "aircraft") return `<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#00F0FF;background:rgba(5,9,20,0.95);border:1px solid #00F0FF;padding:4px 8px;">✈ ${d.data.callsign || d.data.icao24}<br/>ALT ${d.data.altitude || 0}m · VEL ${Math.round(d.data.velocity || 0)}m/s</div>`;
          if (d.kind === "ship") return `<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#FFB800;background:rgba(5,9,20,0.95);border:1px solid #FFB800;padding:4px 8px;">⚓ ${d.data.name}<br/>${d.data.type} · ${d.data.flag}</div>`;
          return "";
        }}
        onPointClick={(d) => {
          if (d.kind === "event" && onEventClick) onEventClick(d.data);
        }}

        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        ringColor={d => t => `rgba(${d.color === "#FF2A2A" ? "255,42,42" : "255,107,53"}, ${1 - t})`}

        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ["#00F0FF", "#00F0FF"]}
        arcAltitude={0.35}
        arcStroke={0.4}
        arcDashLength={0.4}
        arcDashGap={0.15}
        arcDashAnimateTime={3000}

        animateIn={true}
      />
    </div>
  );
}
