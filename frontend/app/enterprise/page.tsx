"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, CheckCircle2, Loader2, AlertCircle,
  ExternalLink, ChevronDown, ChevronUp, Copy, Clock,
  Zap, GitPullRequest, Bell, Database, AlertTriangle,
  ShieldAlert, Info, BarChart3, Send, Bot, User, Trash2, MessageSquare
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useStore, PipelineEvent, JobResult } from "@/store/useStore";
import { uploadEnterprise, getJobResult, ragChat, getProjectDocuments } from "@/lib/api";
import { subscribeToJob } from "@/lib/sse";

const STEPS = [
  { key: "ingest_complete",         label: "Ingest",      sub: "File validation & hash" },
  { key: "extraction_complete",     label: "Extract",     sub: "Clause segmentation" },
  { key: "memory_scan_complete",    label: "Memory Scan", sub: "ChromaDB vector search" },
  { key: "classification_complete", label: "Classify",    sub: "Risk scoring per clause" },
  { key: "redline_complete",        label: "Redline",     sub: "Compliant replacements" },
  { key: "pipeline_complete",       label: "Report",      sub: "GitHub PR + Slack" },
];

const RISK_COLOR: Record<string, string> = {
  violation: "#ff4d4d", high: "#ff8c42", medium: "#ffc542",
  low: "#42b4ff", compliant: "#42ffa1",
};

const SUGGESTIONS = [
  "Which contracts allow unlimited sub-processing?",
  "Show me all data retention clauses",
  "What DPDP violations were found?",
  "Compare termination clauses across vendors",
];

function RiskBadge({ level }: { level: string }) {
  return <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 8px", background: "#111111", color: RISK_COLOR[level] || "#fff", textTransform: "uppercase" }}>{level}</span>;
}

function ClauseCard({ clause }: { clause: JobResult["clauses"][0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: "0px", overflow: "hidden",
      background: "var(--bg)",
      border: `2px solid #111111`,
      marginBottom: "12px",
      boxShadow: "4px 4px 0 #111111"
    }}>
      <button
        style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: "14px", padding: "18px 20px", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ width: "12px", height: "12px", borderRadius: "0%", border: "2px solid #111111", background: RISK_COLOR[clause.risk_level] || "#111111", flexShrink: 0, marginTop: "6px" }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <RiskBadge level={clause.risk_level} />
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 8px", background: "transparent", color: "#111111", border: "1px solid #111111", textTransform: "uppercase" }}>
              {clause.clause_type.replace(/_/g, " ")}
            </span>
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 8px", background: "var(--accent)", color: "#111111", border: "1px solid #111111", textTransform: "uppercase" }}>
              {clause.regulation}
            </span>
          </div>
          <p style={{ fontSize: "14px", color: "#111111", fontWeight: 600, WebkitLineClamp: 2, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", lineHeight: 1.5 }}>
            {clause.text}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111111" }}>{Math.round(clause.confidence * 100)}%</span>
          {open ? <ChevronUp size={16} color="#111111" strokeWidth={3} /> : <ChevronDown size={16} color="#111111" strokeWidth={3} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: "2px solid #111111" }}>
          <div style={{ paddingTop: "16px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "#111111", marginBottom: "6px" }}>ORIGINAL</p>
            <p style={{ fontSize: "14px", color: "#111111", fontWeight: 500, lineHeight: 1.5 }}>{clause.text}</p>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "#111111", marginBottom: "6px" }}>RISK EXPLANATION</p>
            <p style={{ fontSize: "14px", color: "var(--text-body)", lineHeight: 1.5 }}>{clause.explanation}</p>
          </div>
          {clause.redlined_text && (
            <div style={{ padding: "16px", background: "#f2fff7", border: "2px solid #111111" }}>
              <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "#111111", marginBottom: "6px" }}>✦ COMPLIANT REDLINE</p>
              <p style={{ fontSize: "14px", color: "#111111", fontWeight: 600, lineHeight: 1.5 }}>{clause.redlined_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadZone({ onJobStart }: { onJobStart: (id: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [orgId, setOrgId] = useState("demo-org");
  const [projectId, setProjectId] = useState("demo-project");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((dropped: File[]) => {
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.name));
        return [...prev, ...dropped.filter(f => !existing.has(f.name))];
      });
      setError(null);
    }, []),
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    multiple: true, maxSize: 52_428_800,
  });

  async function submit() {
    if (!files.length) return;
    if (!orgId.trim() || !projectId.trim()) {
      setError("Org ID and Project ID are required.");
      return;
    }
    setUploading(true); setError(null);
    try {
      const r = await uploadEnterprise(files[0], orgId, projectId);
      onJobStart(r.job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <div {...getRootProps()}
        style={{ padding: files.length ? "32px 40px" : "72px 40px", textAlign: "center", border: "4px solid #111111", borderRadius: "0", background: "var(--bg)", boxShadow: "8px 8px 0 var(--accent)", cursor: "pointer", transition: "padding 0.2s" }}>
        <input {...getInputProps()} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "72px", height: "72px", background: "var(--accent)", border: "4px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", transform: isDragActive ? "scale(1.08)" : "none", transition: "transform 0.2s" }}>
            {files.length > 0 ? <FileText size={32} color="#ffffff" strokeWidth={2.5} /> : <Upload size={32} color="#ffffff" strokeWidth={2.5} />}
          </div>
          <div>
            <p style={{ fontWeight: 900, color: "#111111", marginBottom: "8px", fontSize: "18px", textTransform: "uppercase" }}>
              {isDragActive ? "Drop here!" : files.length ? "Drop more or click to add" : "Drop contracts here"}
            </p>
            <p style={{ fontSize: "14px", color: "var(--text-body)", fontWeight: 600 }}>PDF or DOCX · max 50MB each · multiple files OK</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div style={{ margin: "20px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", color: "#111111", marginBottom: "4px" }}>
            {files.length} FILE{files.length > 1 ? "S" : ""} SELECTED
          </p>
          {files.map((f) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", border: "2px solid #111111", background: "var(--bg)", boxShadow: "2px 2px 0 #111111" }}>
              <div style={{ width: "28px", height: "28px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={14} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: 800, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                <p style={{ fontSize: "12px", color: "var(--text-body)", fontWeight: 600 }}>{(f.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(x => x.name !== f.name)); }}
                style={{ background: "transparent", border: "2px solid #ff4d4d", padding: "4px 10px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: "#ff4d4d" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "20px 0" }}>
        {[["ORG ID", orgId, setOrgId], ["PROJECT ID", projectId, setProjectId]].map(([label, val, setter]) => (
          <div key={label as string}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", color: "#111111", marginBottom: "8px" }}>{label as string}</p>
            <input style={{ width: "100%", padding: "14px", fontSize: "15px", border: "2px solid #111111", background: "var(--bg)", color: "#111111", fontWeight: 600, outline: "none" }} value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} />
          </div>
        ))}
      </div>

      {error && (
        <div style={{ display: "flex", gap: "10px", padding: "16px", background: "#ffeeee", border: "2px solid #ff4d4d", marginBottom: "16px" }}>
          <AlertCircle size={18} color="#ff4d4d" strokeWidth={3} />
          <span style={{ fontSize: "14px", color: "#ff4d4d", fontWeight: 700 }}>{error}</span>
        </div>
      )}

      <button disabled={!files.length || uploading}
        style={{ width: "100%", padding: "20px", fontSize: "16px", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: !files.length || uploading ? "rgba(17,17,17,0.05)" : "var(--accent)", color: !files.length || uploading ? "rgba(17,17,17,0.4)" : "#ffffff", border: "4px solid #111111", boxShadow: "6px 6px 0 #111111", cursor: !files.length || uploading ? "not-allowed" : "pointer", transition: "transform 0.1s" }}
        onClick={submit}
        onMouseDown={e => { if (files.length && !uploading) { e.currentTarget.style.transform = "translate(4px, 4px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #111111"; } }}
        onMouseUp={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "6px 6px 0 #111111"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "6px 6px 0 #111111"; }}>
        {uploading ? <Loader2 size={20} className="anim-spin" /> : <Zap size={20} strokeWidth={3} />}
        {uploading ? "Uploading…" : `Launch Pipeline${files.length > 1 ? ` (${files.length} files)` : ""}`}
      </button>
    </div>
  );
}

function PipelineMonitor({ jobId, onComplete }: { jobId: string; onComplete: (r: JobResult) => void }) {
  const { pipelineEvents, addPipelineEvent } = useStore();
  const [activeStep, setActiveStep] = useState(0);
  const completedKeys = pipelineEvents.map(e => e.event);

  useEffect(() => {
    const unsub = subscribeToJob(jobId,
      (ev) => {
        const event = ev as PipelineEvent;
        addPipelineEvent(event);
        const idx = STEPS.findIndex(s => s.key === event.event);
        if (idx >= 0) setActiveStep(idx);

        // pipeline_complete carries the full result inline — use it directly
        if (event.event === "pipeline_complete") {
          const raw = ev as Record<string, unknown>;
          const summary = {
            total_clauses: (raw.total_clauses as number) ?? 0,
            violation: (raw.violation_count as number) ?? 0,
            high: (raw.high_count as number) ?? 0,
            medium: (raw.medium_count as number) ?? 0,
            low: 0,
            compliant: 0,
          };
          summary.low = Math.max(0, summary.total_clauses - summary.violation - summary.high - summary.medium);
          const result: JobResult = {
            job_id: jobId,
            status: "complete",
            filename: (raw.filename as string) || jobId,
            duration_seconds: (raw.duration_seconds as number) ?? 0,
            summary,
            clauses: (raw.clauses as JobResult["clauses"]) || [],
            contradictions: (raw.contradictions as JobResult["contradictions"]) || [],
            historical_flags: (raw.historical_flags as JobResult["historical_flags"]) || [],
            github_pr_url: (raw.pr_url as string) || "",
            slack_sent: (raw.slack_sent as boolean) || false,
            audit_trail: { file_hash: "", timestamp: "" },
          };
          onComplete(result);
        }
      },
      async () => {
        // fallback: poll if SSE closes without pipeline_complete
        try {
          const r = await getJobResult(jobId);
          if (r.status === "complete") onComplete(r);
        } catch { /* noop */ }
      }
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "var(--accent)", border: "4px solid #111111", marginBottom: "32px", boxShadow: "4px 4px 0 #111111" }}>
        <div>
          <p style={{ fontSize: "11px", color: "#111111", fontWeight: 800, letterSpacing: "0.1em" }}>JOB ID</p>
          <p style={{ fontFamily: "monospace", fontSize: "14px", color: "#111111", fontWeight: 900 }}>{jobId}</p>
        </div>
        <button onClick={() => navigator.clipboard.writeText(jobId)} style={{ background: "#111111", border: "none", cursor: "pointer", padding: "8px" }}>
          <Copy size={16} color="var(--accent)" />
        </button>
      </div>

      <div>
        {STEPS.map((step, i) => {
          const done = completedKeys.includes(step.key);
          const active = !done && i === activeStep;
          const classify = pipelineEvents.find(e => e.event === "classification_progress");
          return (
            <div key={step.key} style={{ position: "relative", display: "flex", gap: "20px", marginBottom: "16px" }}>
              <div style={{
                width: "48px", height: "48px", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "#42ffa1" : active ? "var(--accent)" : "transparent",
                border: "2px solid #111111",
              }}>
                {done ? <CheckCircle2 size={24} color="#111111" strokeWidth={3} /> : active ? <Loader2 size={24} color="#ffffff" className="anim-spin" /> : <div style={{ width: "10px", height: "10px", background: "#111111" }} />}
              </div>
              <div style={{ paddingBottom: "24px", flex: 1, borderBottom: "2px solid rgba(17,17,17,0.1)" }}>
                <p style={{ fontSize: "18px", fontWeight: 900, textTransform: "uppercase", color: "#111111" }}>{step.label}</p>
                <p style={{ fontSize: "14px", color: "var(--text-body)", marginTop: "4px", fontWeight: 500 }}>
                  {step.sub}
                  {step.key === "extraction_complete" && done && <> · <b>{pipelineEvents.find(e => e.event === "extraction_complete")?.clause_count} clauses</b></>}
                  {step.key === "classification_complete" && classify && <> · <b>{classify.done}/{classify.total}</b></>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskReport({ result }: { result: JobResult }) {
  const [tab, setTab] = useState<"clauses" | "contradictions" | "flags">("clauses");

  return (
    <div>
      {/* header */}
      <div style={{ padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px", flexWrap: "wrap", border: "4px solid #111111", boxShadow: "8px 8px 0 #111111", background: "var(--bg)" }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.1em", color: "#111111", marginBottom: "6px" }}>ANALYSIS COMPLETE</p>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 3vw, 44px)", color: "#111111", lineHeight: 0.95 }}>{result.filename}</h2>
          <p style={{ fontSize: "14px", color: "var(--text-body)", marginTop: "8px", fontWeight: 600 }}>
            <Clock size={14} style={{ display: "inline", marginRight: "4px" }} />
            {result.duration_seconds?.toFixed(1)}s · {result.summary.total_clauses} clauses
          </p>
        </div>
        {result.github_pr_url && (
          <a href={result.github_pr_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button style={{ padding: "12px 20px", background: "transparent", border: "2px solid #111111", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#111111" }}>
              <GitPullRequest size={16} strokeWidth={3} /> View PR
            </button>
          </a>
        )}
      </div>

      {/* summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {(["violation","high","medium","low","compliant"] as const).map(level => (
          <div key={level} style={{ padding: "20px 10px", background: "var(--bg)", border: `2px solid #111111`, borderBottom: `6px solid ${RISK_COLOR[level] || "#111111"}`, textAlign: "center" }}>
            <div className="font-display" style={{ fontSize: "48px", color: "#111111", lineHeight: 1 }}>{result.summary[level as keyof typeof result.summary]}</div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#111111", marginTop: "8px", textTransform: "uppercase" }}>{level}</div>
          </div>
        ))}
      </div>

      {/* outputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { icon: GitPullRequest, color: "#42ffa1", title: "GitHub PR Created", sub: result.github_pr_url ? "View redline diff →" : "Not created" },
          { icon: Bell, color: "#ffc542", title: "Slack Alert", sub: result.slack_sent ? "Sent to channel ✓" : "Not sent" },
          { icon: Database, color: "var(--accent)", title: "Audit Trail", sub: result.audit_trail?.file_hash ? `sha256:${result.audit_trail.file_hash.slice(0,10)}…` : "Logged" },
        ].map((item, i) => (
          <div key={i} style={{ padding: "18px 20px", display: "flex", gap: "12px", alignItems: "center", border: "2px solid #111111", background: "var(--bg)" }}>
            <div style={{ width: "36px", height: "36px", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <item.icon size={18} color={item.color} strokeWidth={3} />
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>{item.title}</p>
              <p style={{ fontSize: "12px", color: "var(--text-body)", marginTop: "2px", fontWeight: 600 }}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {(["clauses","contradictions","flags"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "12px 24px", fontSize: "14px", fontWeight: 800, textTransform: "uppercase",
            background: tab === t ? "#111111" : "transparent",
            color: tab === t ? "var(--accent)" : "#111111",
            border: "2px solid #111111",
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {t === "flags" ? "Hist. Flags" : t}
            <span style={{ marginLeft: "8px", opacity: 0.8 }}>
              {t === "clauses" ? (result.clauses || []).length : t === "contradictions" ? (result.contradictions || []).length : (result.historical_flags || []).length}
            </span>
          </button>
        ))}
      </div>

      {tab === "clauses" && (
        <div>
          {(["violation","high","medium","low","compliant"] as const).map(level => {
            const clauses = (result.clauses || []).filter(c => c.risk_level === level);
            if (!clauses.length) return null;
            return (
              <div key={level} style={{ marginBottom: "32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, padding: "6px 12px", background: "#111111", color: RISK_COLOR[level] || "#fff", textTransform: "uppercase" }}>{level} RISK</span>
                  <span style={{ fontSize: "14px", color: "#111111", fontWeight: "bold" }}>{clauses.length} clause{clauses.length > 1 ? "s" : ""}</span>
                </div>
                {clauses.map(c => <ClauseCard key={c.clause_id} clause={c} />)}
              </div>
            );
          })}
        </div>
      )}

      {tab === "contradictions" && (
        <div>
          {(result.contradictions || []).length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", border: "2px solid #111111" }}>
              <CheckCircle2 size={48} color="#111111" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "#111111", fontWeight: "bold", fontSize: "16px", textTransform: "uppercase" }}>No contradictions detected.</p>
            </div>
          ) : (result.contradictions || []).map((c, i) => (
            <div key={i} style={{ padding: "24px", marginBottom: "16px", border: "2px solid #111111", boxShadow: "4px 4px 0 #111111" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <AlertTriangle size={20} color="#ff8c42" strokeWidth={3} />
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>Contradiction — {c.severity}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[{id: c.clause_a_id, text: c.clause_a_text}, {id: c.clause_b_id, text: c.clause_b_text}].map((s, j) => (
                  <div key={j} style={{ padding: "16px", background: "#fff5f0", border: "2px solid #ff8c42" }}>
                    <p style={{ fontFamily: "monospace", fontSize: "12px", color: "#111111", fontWeight: "bold", marginBottom: "8px" }}>{s.id}</p>
                    <p style={{ fontSize: "14px", color: "#111111", fontWeight: 500 }}>{s.text}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "14px", color: "#111111", fontWeight: 600, marginTop: "16px", padding: "16px", background: "rgba(17,17,17,0.05)" }}>{c.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "flags" && (
        <div>
          {(result.historical_flags || []).length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", border: "2px solid #111111" }}>
              <ShieldAlert size={48} color="#111111" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "#111111", fontWeight: "bold", fontSize: "16px", textTransform: "uppercase" }}>No historical flags found.</p>
            </div>
          ) : (result.historical_flags || []).map((f, i) => (
            <div key={i} style={{ padding: "24px", marginBottom: "16px", border: "2px solid #111111", boxShadow: "4px 4px 0 #111111" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <Info size={18} color="#111111" strokeWidth={3} />
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>Previously flagged</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 6px", background: "#111111", color: RISK_COLOR[f.original_risk_level] || "#fff", textTransform: "uppercase" }}>{f.original_risk_level}</span>
              </div>
              <p style={{ fontSize: "15px", color: "#111111", fontWeight: 500, marginBottom: "12px" }}>{f.text}</p>
              <p style={{ fontSize: "12px", color: "var(--text-body)", fontWeight: "bold" }}>
                {f.flagged_in_project} · {f.flagged_in_job} · {new Date(f.flagged_date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EnterprisePage() {
  const { currentJobId, jobResult, isProcessing, setCurrentJobId, setJobResult, setIsProcessing, resetPipeline, chatHistory, addChatMessage, clearChat } = useStore();

  const phase = !currentJobId ? "upload" : isProcessing ? "monitor" : "result";

  // Chat State — auto-sync from completed job so no hardcoded defaults
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOrgId, setChatOrgId] = useState(jobResult?.org_id ?? "demo-org");
  const [chatProjectId, setChatProjectId] = useState(jobResult?.project_id ?? "demo-project");
  const [projectDocs, setProjectDocs] = useState<{filename: string, job_id: string, created_at: string, tier: string}[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep chat org/project in sync when a new job completes
  useEffect(() => {
    if (jobResult?.org_id)    setChatOrgId(jobResult.org_id);
    if (jobResult?.project_id) setChatProjectId(jobResult.project_id);
  }, [jobResult]);

  useEffect(() => {
    if (!chatOrgId || !chatProjectId) return;
    setLoadingDocs(true);
    getProjectDocuments(chatOrgId, chatProjectId)
      .then(res => setProjectDocs(res.documents || []))
      .catch(() => setProjectDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [chatOrgId, chatProjectId, jobResult]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, loading]);

  async function send() {
    const q = query.trim(); if (!q || loading) return;
    setQuery(""); addChatMessage({ role: "user", content: q }); setLoading(true);
    try {
      const res = await ragChat(chatOrgId, chatProjectId, q, chatHistory.map(m => ({ role: m.role, content: m.content })));
      addChatMessage({ role: "assistant", content: res.answer, sources: res.sources });
    } catch (e: unknown) {
      addChatMessage({ role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Something went wrong"}` });
    } finally { setLoading(false); }
  }

  return (
    <div className="theme-light" style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar />
      
      <div style={{ display: "flex", flex: 1, overflow: "hidden", paddingTop: "80px" }}>
        
        {/* LEFT SECTION: PIPELINE */}
        <div style={{ flex: 1, overflowY: "auto", borderRight: "4px solid #111111", padding: "60px 40px", display: "flex", flexDirection: "column" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
            
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.1em", color: "#111111", marginBottom: "12px" }}>CAVEAT · ENTERPRISE PIPELINE</p>
              <h1 className="font-display" style={{ fontSize: "clamp(48px, 6vw, 100px)", color: "#111111", lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                CONTRACT
                <br />
                <span style={{ color: "transparent", WebkitTextStroke: "2px #111111" }}>ANALYSIS</span>
              </h1>
            </div>

            {phase === "upload" && (
              <UploadZone onJobStart={id => { resetPipeline(); setCurrentJobId(id); setIsProcessing(true); }} />
            )}
            {phase === "monitor" && currentJobId && (
              <PipelineMonitor jobId={currentJobId} onComplete={r => { setJobResult(r); setIsProcessing(false); }} />
            )}
            {phase === "result" && jobResult && <RiskReport result={jobResult} />}

            {phase !== "upload" && (
              <div style={{ textAlign: "center", marginTop: "40px" }}>
                <button onClick={resetPipeline} style={{ fontSize: "14px", fontWeight: 800, textTransform: "uppercase", padding: "12px 24px", background: "transparent", border: "2px solid #111111", cursor: "pointer", color: "#111111" }}>
                  ← Analyse another contract
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: RAG CHAT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.02)" }}>
          
          <div style={{ padding: "20px 32px", borderBottom: "4px solid #111111", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", background: "var(--bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #111111" }}>
                <Database size={24} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ fontWeight: 900, color: "#111111", fontSize: "18px", textTransform: "uppercase" }}>RAG Contract Chat</p>
                <p style={{ fontSize: "13px", color: "var(--text-body)", fontWeight: 600 }}>ChromaDB + Qwen3-32B</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input style={{ width: "120px", fontSize: "14px", fontWeight: 600, padding: "10px 14px", border: "2px solid #111111", background: "var(--bg)", outline: "none" }} placeholder="Org ID" value={chatOrgId} onChange={e => setChatOrgId(e.target.value)} />
              <input style={{ width: "140px", fontSize: "14px", fontWeight: 600, padding: "10px 14px", border: "2px solid #111111", background: "var(--bg)", outline: "none" }} placeholder="Project ID" value={chatProjectId} onChange={e => setChatProjectId(e.target.value)} />
              {chatHistory.length > 0 && (
                <button onClick={clearChat} style={{ width: "42px", height: "42px", background: "transparent", border: "2px solid #ff4d4d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Trash2 size={18} color="#ff4d4d" strokeWidth={3} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Project Documents Sidebar */}
            <div style={{ width: "260px", borderRight: "4px solid #111111", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px", borderBottom: "2px solid #111111", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", color: "#111111" }}>PROJECT DOCS</span>
                <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 6px", background: "#111111", color: "#fff" }}>{projectDocs.length}</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {loadingDocs ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><Loader2 size={20} className="anim-spin" color="#111111" /></div>
                ) : projectDocs.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--text-body)", fontWeight: 600, textAlign: "center", padding: "20px 0" }}>No documents found</div>
                ) : (
                  projectDocs.map((doc, idx) => (
                    <div key={idx} style={{ padding: "12px", marginBottom: "8px", border: "2px solid #111111", background: "rgba(17,17,17,0.02)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                        <FileText size={14} color="#111111" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#111111", wordBreak: "break-all", lineHeight: 1.3 }}>{doc.filename}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-body)", textTransform: "uppercase" }}>{new Date(doc.created_at).toLocaleDateString()}</span>
                        {doc.tier && <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", background: "var(--accent)", color: "#111111", textTransform: "uppercase" }}>{doc.tier}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

          <div style={{ flex: 1, overflowY: "auto", padding: "40px", display: "flex", flexDirection: "column", gap: "32px" }}>
            {chatHistory.length === 0 && (
              <div style={{ margin: "auto 0", textAlign: "center" }}>
                <div style={{ width: "96px", height: "96px", background: "transparent", border: "4px solid #111111", boxShadow: "6px 6px 0 #111111", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
                  <MessageSquare size={48} color="#111111" strokeWidth={2} />
                </div>
                <h2 className="font-display" style={{ fontSize: "clamp(48px, 6vw, 80px)", color: "#111111", lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                  ASK YOUR<br /><span style={{ color: "transparent", WebkitTextStroke: "2px #111111" }}>CONTRACTS</span>
                </h2>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "48px", maxWidth: "600px", margin: "48px auto 0" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => setQuery(s)} style={{
                      padding: "20px", textAlign: "left", fontSize: "14px", fontWeight: 700, color: "#111111",
                      background: "var(--bg)", cursor: "pointer", border: "2px solid #111111",
                      boxShadow: "4px 4px 0 #111111", transition: "all 0.1s",
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = "translate(2px, 2px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #111111"; }}
                    onMouseUp={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "4px 4px 0 #111111"; }}>
                      <span style={{ color: "var(--accent)" }}>→ </span>{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: "16px", maxWidth: "800px", margin: "0 auto", width: "100%", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: "48px", height: "48px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: msg.role === "user" ? "#111111" : "var(--accent)",
                  border: "2px solid #111111",
                }}>
                  {msg.role === "user" ? <User size={24} color="var(--bg)" strokeWidth={2.5} /> : <Bot size={24} color="#ffffff" strokeWidth={2.5} />}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ padding: "20px 24px", maxWidth: "85%", fontSize: "15px", fontWeight: 600, lineHeight: "1.6", color: "#111111", background: "var(--bg)", border: "2px solid #111111", boxShadow: msg.role === "user" ? "-4px 4px 0 #111111" : "4px 4px 0 #111111" }}>
                    {msg.content}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ width: "100%", marginTop: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", color: "#111111", marginBottom: "12px" }}>SOURCES</p>
                      {msg.sources.map((src, j) => (
                        <div key={j} style={{ padding: "16px", background: "var(--bg)", border: "2px solid #111111", display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "8px" }}>
                          <Database size={16} color="#111111" style={{ flexShrink: 0, marginTop: "2px" }} strokeWidth={2.5} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                              <span style={{ fontSize: "14px", fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>{src.filename}</span>
                              <span style={{ padding: "2px 6px", background: "#111111", color: "var(--bg)", fontSize: "10px", fontWeight: 800 }}>{src.clause_id}</span>
                              <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--accent)" }}>{Math.round(src.relevance_score * 100)}%</span>
                            </div>
                            <p style={{ fontSize: "13px", color: "var(--text-body)", fontWeight: 500, lineHeight: 1.5 }}>{src.clause_text}</p>
                          </div>
                          <ExternalLink size={14} color="#111111" style={{ flexShrink: 0 }} strokeWidth={2.5} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "16px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
                <div style={{ width: "48px", height: "48px", background: "var(--accent)", border: "2px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bot size={24} color="#ffffff" strokeWidth={2.5} />
                </div>
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "12px", background: "var(--bg)", border: "2px solid #111111", boxShadow: "4px 4px 0 #111111" }}>
                  <Loader2 size={18} color="#111111" className="anim-spin" strokeWidth={3} />
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>Searching contracts…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "24px 32px", borderTop: "4px solid #111111", background: "var(--bg)" }}>
            <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", gap: "16px" }}>
              <input style={{ flex: 1, padding: "16px 20px", fontSize: "15px", fontWeight: 600, border: "4px solid #111111", outline: "none", color: "#111111", background: "var(--bg)" }}
                placeholder="Ask about any clause, regulation, or risk…"
                value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} disabled={loading} />
              <button onClick={send} disabled={!query.trim() || loading}
                style={{ padding: "16px 32px", background: !query.trim() || loading ? "rgba(17,17,17,0.05)" : "var(--accent)", border: "4px solid #111111", boxShadow: "4px 4px 0 #111111", color: !query.trim() || loading ? "rgba(17,17,17,0.4)" : "#ffffff", fontWeight: 900, fontSize: "15px", textTransform: "uppercase", cursor: !query.trim() || loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "transform 0.1s" }}
                onMouseDown={e => { if(!(!query.trim() || loading)) { e.currentTarget.style.transform = "translate(2px, 2px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #111111"; } }}
                onMouseUp={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "4px 4px 0 #111111"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "4px 4px 0 #111111"; }}>
                {loading ? <Loader2 size={18} className="anim-spin" /> : <Send size={18} strokeWidth={3} />}
                Send
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
