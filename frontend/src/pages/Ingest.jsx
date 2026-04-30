import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { FileUp, FileText, FileSpreadsheet, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Ingest() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [upload, setUpload] = useState({ busy: false, progress: 0, last: null, error: "" });
  const [classification, setClassification] = useState("public");
  const [tags, setTags] = useState("");
  const [drag, setDrag] = useState(false);

  const load = () => api.get("/files").then(r => setFiles(r.data));
  useEffect(() => { load(); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setUpload({ busy: true, progress: 0, last: null, error: "" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("classification", classification);
    fd.append("tags", tags);
    try {
      const r = await api.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => setUpload(u => ({ ...u, progress: Math.round((p.loaded / (p.total || 1)) * 100) })),
      });
      setUpload({ busy: false, progress: 100, last: r.data, error: "" });
      load();
    } catch (e) {
      setUpload({ busy: false, progress: 0, last: null, error: formatApiError(e.response?.data?.detail) || e.message });
    }
  };

  const canUpload = ["admin", "analyst"].includes(user?.role);

  const icon = (t) => {
    if (t === "pdf") return <FileText className="w-4 h-4 text-critical" />;
    if (["xlsx", "xls", "csv"].includes(t)) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    return <FileText className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <Layout>
      <div className="h-full flex flex-col p-3 gap-3 relative">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-40"></div>
        <div className="glass p-3 flex items-center gap-3 z-10">
          <FileUp className="w-4 h-4 text-cyan-300" />
          <span className="font-display tracking-widest text-sm text-slate-200">DATA INGESTION PIPELINE</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">OCR · NER · AUTO-LINK · CLAUDE SONNET 4.5</span>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 z-10">
          <div className="col-span-5 glass p-5 flex flex-col gap-4">
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Classification</label>
              <select value={classification} onChange={e => setClassification(e.target.value)} disabled={!canUpload}
                data-testid="classification-select"
                className="tactical-input w-full">
                <option value="public">PUBLIC</option>
                <option value="restricted">RESTRICTED</option>
                <option value="classified">CLASSIFIED</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-widest text-cyan-400/70 mb-1">Tags (comma sep)</label>
              <input data-testid="tags-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="sigint, afghan-2024" className="tactical-input w-full" disabled={!canUpload}/>
            </div>

            <label
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition cursor-pointer
                ${drag ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-slate-700 text-slate-400 hover:border-cyan-400/60 hover:text-cyan-300"}
                ${!canUpload ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid="dropzone"
            >
              <FileUp className="w-10 h-10 mb-2" />
              <div className="font-display text-lg tracking-widest">DROP FILES HERE</div>
              <div className="font-mono text-[11px] mt-1">PDF · XLSX · CSV · TXT</div>
              <input type="file" className="hidden" disabled={!canUpload}
                accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.log"
                onChange={(e) => handleFile(e.target.files?.[0])}
                data-testid="file-input"
              />
              {!canUpload && <div className="font-mono text-[10px] text-amber-400 mt-2">VIEWER ROLE · READ-ONLY</div>}
            </label>

            {upload.busy && (
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-cyan-300">UPLOADING + PROCESSING...</span>
                  <span className="text-slate-400">{upload.progress}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 border border-cyan-400/20">
                  <div className="h-full bg-cyan-400 sweep-line relative" style={{ width: `${upload.progress}%` }}></div>
                </div>
              </div>
            )}
            {upload.error && <div className="text-critical text-xs font-mono border border-critical/40 bg-critical/10 p-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{upload.error}</div>}

            {upload.last && (
              <div className="border border-emerald-400/40 bg-emerald-400/5 p-3" data-testid="upload-result">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-[11px] text-emerald-400 uppercase tracking-widest">INGESTED</span>
                </div>
                <div className="mt-2 text-sm text-slate-200 font-display tracking-wide">{upload.last.name}</div>
                <div className="mt-1 text-[11px] text-slate-300">{upload.last.entities?.summary}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {upload.last.entities?.persons?.map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
                      {typeof p === "string" ? p : p.name}
                    </span>
                  ))}
                  {upload.last.entities?.organizations?.map((o, i) => (
                    <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-warn/10 border border-warn/30 text-warn">{o}</span>
                  ))}
                  {upload.last.entities?.locations?.map((l, i) => (
                    <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-400/10 border border-emerald-400/30 text-emerald-400">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-7 glass overflow-hidden flex flex-col" data-testid="file-list">
            <div className="px-3 py-2 border-b border-cyan-400/20 font-mono text-[10px] uppercase tracking-widest text-slate-500 flex items-center">
              <span className="flex-1">Ingested Documents</span>
              <span className="font-mono text-cyan-300">{files.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.map(f => (
                <div key={f.id} className="border-b border-cyan-400/10 p-3 hover:bg-cyan-400/5 transition" data-testid={`file-${f.id}`}>
                  <div className="flex items-start gap-2">
                    {icon(f.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-100 font-medium text-sm truncate">{f.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {f.type?.toUpperCase()} · {Math.round(f.size / 1024)}kb · by {f.uploaded_by} · {new Date(f.uploaded_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border tracking-widest
                      ${f.classification === "classified" ? "border-critical/50 text-critical" :
                        f.classification === "restricted" ? "border-warn/50 text-warn" :
                        "border-emerald-400/40 text-emerald-400"}`}>{f.classification}</span>
                  </div>
                  {f.entities?.summary && (
                    <div className="mt-2 text-[11px] text-slate-300 border-l-2 border-cyan-400/40 pl-2">{f.entities.summary}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.tags?.map(t => <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400">#{t}</span>)}
                    {f.entities?.persons?.slice(0, 3).map((p, i) => (
                      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
                        {typeof p === "string" ? p : p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {files.length === 0 && <div className="p-12 text-center text-slate-500 text-sm font-mono">NO DOCUMENTS INGESTED YET</div>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
