"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Camera, FileText, AlertCircle, Loader2, RefreshCw, Globe, Zap, ShieldAlert, ChevronDown, ChevronUp, Scale } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useStore, ConsumerAnalysis, FlaggedClause } from "@/store/useStore";
import { uploadConsumerFile, uploadConsumerPhoto, analyseConsumerText } from "@/lib/api";

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "ml", label: "മലയാളം" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

const RISK_COLOR: Record<string, string> = {
  violation: "#ff4d4d", high: "#ff8c42", medium: "#ffc542", low: "#42b4ff", compliant: "#42ffa1",
};

function FlaggedClauseCard({ clause, idx }: { clause: FlaggedClause; idx: number }) {
  const [open, setOpen] = useState(false);
  const lvl = clause.risk_level || "low";
  return (
    <div style={{ border: "2px solid #111111", marginBottom: "12px", boxShadow: "4px 4px 0 #111111", background: "var(--bg)" }}>
      <button style={{ width: "100%", display: "flex", gap: "12px", padding: "18px 20px", textAlign: "left", background: "none", border: "none", cursor: "pointer", alignItems: "flex-start" }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ width: "12px", height: "12px", background: RISK_COLOR[lvl] || "#111111", border: "2px solid #111111", flexShrink: 0, marginTop: "4px" }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 900, padding: "3px 8px", background: "#111111", color: RISK_COLOR[lvl] || "#fff", textTransform: "uppercase" }}>{lvl}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", border: "1px solid #111111", textTransform: "uppercase", color: "#111111" }}>{(clause.clause_type || "other").replace(/_/g, " ")}</span>
            {clause.dark_pattern && <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", background: "#EC4899", color: "#fff", textTransform: "uppercase" }}>🎭 {(clause.dark_pattern_type || "dark pattern").replace(/_/g, " ")}</span>}
            {clause.confidence && <span style={{ fontSize: "11px", color: "#111111", fontWeight: 700 }}>{Math.round(clause.confidence * 100)}%</span>}
          </div>
          <p style={{ fontSize: "14px", color: "#111111", fontWeight: 600, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: open ? undefined : 2, WebkitBoxOrient: "vertical" }}>
            {clause.clause_text}
          </p>
        </div>
        {open ? <ChevronUp size={18} color="#111111" strokeWidth={3} /> : <ChevronDown size={18} color="#111111" strokeWidth={3} />}
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: "2px solid #111111" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
            {[
              clause.why_flagged && { title: "⚠️ Why Flagged", body: clause.why_flagged },
              clause.what_it_means && { title: "💡 What It Means", body: clause.what_it_means },
              clause.consequence && { title: "⚡ Consequence", body: clause.consequence },
              clause.financial_impact && { title: "💰 Financial Impact", body: clause.financial_impact },
            ].filter(Boolean).map((r, i) => r && (
              <div key={i} style={{ padding: "14px", background: "rgba(17,17,17,0.04)", border: "1px solid #111111" }}>
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", color: "#111111", marginBottom: "6px" }}>{r.title}</p>
                <p style={{ fontSize: "13px", color: "#111111", lineHeight: 1.6, fontWeight: 500 }}>{r.body}</p>
              </div>
            ))}
          </div>
          {clause.translated_explanation && clause.translated_explanation !== clause.why_flagged && (
            <div style={{ marginTop: "12px", padding: "14px", background: "rgba(17,17,17,0.04)", border: "1px solid #111111" }}>
              <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", color: "#111111", marginBottom: "6px" }}>🌐 In Your Language</p>
              <p style={{ fontSize: "13px", color: "#111111", fontWeight: 500, lineHeight: 1.6 }}>{clause.translated_explanation}</p>
            </div>
          )}
          {clause.fair_version && (
            <div style={{ marginTop: "12px", padding: "16px", background: "#f2fff7", border: "2px solid #111111" }}>
              <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", color: "#111111", marginBottom: "6px" }}>✦ FAIR VERSION</p>
              <p style={{ fontSize: "14px", color: "#111111", fontWeight: 600 }}>{clause.fair_version}</p>
            </div>
          )}
          {clause.negotiation_tip && (
            <div style={{ marginTop: "12px", padding: "16px", background: "#f0f8ff", border: "2px solid #42b4ff" }}>
              <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", color: "#111111", marginBottom: "6px" }}>🤝 NEGOTIATION TIP</p>
              <p style={{ fontSize: "14px", color: "#111111", fontWeight: 500 }}>{clause.negotiation_tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsumerReport({ analysis, onReset }: { analysis: ConsumerAnalysis; onReset: () => void }) {
  const [filter, setFilter] = useState<"all" | "violation" | "high" | "medium">("all");
  const score = analysis.overall_risk_score || 0;
  const scoreColor = score >= 70 ? "#ff4d4d" : score >= 40 ? "#ff8c42" : "#42ffa1";
  const clauses = analysis.flagged_clauses || [];
  const shown = filter === "all" ? clauses : clauses.filter(c => c.risk_level === filter);
  const riskOrder: Record<string, number> = { violation: 0, high: 1, medium: 2, low: 3, compliant: 4 };
  shown.sort((a, b) => (riskOrder[a.risk_level] ?? 5) - (riskOrder[b.risk_level] ?? 5));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Score / meta card */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "32px", alignItems: "center", padding: "28px", border: "4px solid #111111", boxShadow: "8px 8px 0 #111111", background: "var(--bg)" }}>
        <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(17,17,17,0.08)" strokeWidth="12" />
            <circle cx="80" cy="80" r="68" fill="none" stroke={scoreColor} strokeWidth="12" strokeLinecap="square"
              strokeDasharray="427" strokeDashoffset={427 - (score / 100) * 427} style={{ transition: "stroke-dashoffset 1.2s ease" }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#111111", textTransform: "uppercase", marginTop: "4px" }}>Risk Score</div>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <span style={{ padding: "8px 16px", fontWeight: 900, fontSize: "14px", textTransform: "uppercase", background: analysis.safe_to_sign ? "#42ffa1" : "#ff4d4d", color: "#111111", border: "2px solid #111111" }}>
              {analysis.safe_to_sign ? "✅ Safe to Sign" : "🚫 Do Not Sign"}
            </span>
            {analysis.power_imbalance && (
              <span style={{ padding: "8px 16px", fontWeight: 700, fontSize: "14px", color: "#111111", border: "2px solid #111111" }}>
                ⚖️ {analysis.power_imbalance}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { label: "Document Type", val: (analysis.document_type || "unknown").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
              { label: "Red Flags", val: analysis.red_flags_count ?? 0, color: "#ff4d4d" },
              { label: "Dark Patterns", val: analysis.dark_patterns_count ?? 0, color: "#EC4899" },
              { label: "Total Clauses", val: clauses.length },
            ].map((m, i) => (
              <div key={i} style={{ padding: "14px", border: "2px solid #111111", background: "var(--bg)" }}>
                <p style={{ fontSize: "11px", fontWeight: 800, color: "#111111", letterSpacing: "0.06em", marginBottom: "4px", textTransform: "uppercase" }}>{m.label}</p>
                <p style={{ fontSize: "18px", fontWeight: 900, color: (m as {color?: string}).color || "#111111" }}>{m.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: "24px", border: "4px solid #111111", background: "var(--bg)", boxShadow: "6px 6px 0 #111111" }}>
        <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", color: "#111111", marginBottom: "12px" }}>PLAIN ENGLISH SUMMARY</p>
        <p style={{ fontSize: "15px", color: "#111111", fontWeight: 600, lineHeight: 1.7 }}>{analysis.summary}</p>
        {analysis.translated_summary && analysis.translated_summary !== analysis.summary && (
          <p style={{ fontSize: "14px", color: "#111111", fontWeight: 500, lineHeight: 1.7, marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #111111", fontStyle: "italic" }}>{analysis.translated_summary}</p>
        )}
      </div>

      {/* Negotiation summary */}
      {analysis.negotiation_summary && (
        <div style={{ padding: "24px", border: "4px solid #42b4ff", background: "var(--bg)", boxShadow: "6px 6px 0 #42b4ff" }}>
          <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", color: "#111111", marginBottom: "12px" }}>🤝 NEGOTIATION STRATEGY</p>
          <p style={{ fontSize: "15px", color: "#111111", fontWeight: 600, lineHeight: 1.7 }}>{analysis.negotiation_summary}</p>
        </div>
      )}

      {/* Clauses */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <p style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.1em", color: "#111111" }}>FLAGGED CLAUSES</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "violation", "high", "medium"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "8px 16px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase",
                background: filter === f ? "#111111" : "transparent",
                color: filter === f ? "var(--bg)" : "#111111",
                border: "2px solid #111111", cursor: "pointer",
              }}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
        </div>
        {shown.map((c, i) => <FlaggedClauseCard key={i} clause={c} idx={i} />)}
        {shown.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", border: "2px solid #111111" }}>
            <p style={{ fontWeight: 800, color: "#111111", textTransform: "uppercase" }}>No clauses at this risk level.</p>
          </div>
        )}
      </div>

      {analysis.disclaimer && (
        <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: 600, color: "#111111", border: "2px dashed #111111" }}>
          {analysis.disclaimer}
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <button onClick={onReset} style={{ padding: "14px 28px", fontSize: "14px", fontWeight: 800, textTransform: "uppercase", background: "transparent", border: "2px solid #111111", color: "#111111", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <RefreshCw size={16} strokeWidth={3} /> Analyse Another
        </button>
      </div>
    </div>
  );
}

export default function ConsumerPage() {
  const { consumerAnalysis, consumerLoading, setConsumerAnalysis, setConsumerLoading } = useStore();
  const [mode, setMode] = useState<"file" | "photo" | "text">("file");
  const [lang, setLang] = useState("en");
  const [pasteText, setPasteText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((dropped: File[]) => {
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...dropped.filter(f => !existing.has(f.name))];
    });
    setError(null);
  }, []);

  async function runAnalysis() {
    const file = selectedFiles[0]; if (!file) return;
    setError(null); setConsumerLoading(true); setConsumerAnalysis(null);
    try {
      let res;
      if (mode === "photo") {
        res = await uploadConsumerPhoto(file, lang);
        if (res.status === "low_confidence") {
          setError(`Photo quality too low (${Math.round((res.ocr_confidence || 0) * 100)}%). Retake in better lighting.`);
          setConsumerLoading(false); return;
        }
      } else {
        res = await uploadConsumerFile(file, lang);
      }
      setConsumerAnalysis(res.analysis as ConsumerAnalysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally { setConsumerLoading(false); }
  }

  async function analyseText() {
    if (pasteText.trim().length < 50) { setError("Please paste at least 50 characters of contract text."); return; }
    setError(null); setConsumerLoading(true); setConsumerAnalysis(null);
    try {
      const res = await analyseConsumerText(pasteText.trim(), lang);
      setConsumerAnalysis(res.analysis as ConsumerAnalysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally { setConsumerLoading(false); }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: mode === "photo"
      ? { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }
      : { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    multiple: true,
    disabled: mode === "text",
  });

  if (consumerAnalysis) {
    return (
      <div className="theme-light" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Navbar />
        <div style={{ paddingTop: "120px", padding: "120px 28px 80px" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <ConsumerReport analysis={consumerAnalysis} onReset={() => { setConsumerAnalysis(null); setError(null); }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-light" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ paddingTop: "120px", padding: "120px 28px 80px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.1em", color: "#111111", marginBottom: "12px" }}>CAVEAT · CONSUMER CLARITY</p>
            <h1 className="font-display" style={{ fontSize: "clamp(56px, 10vw, 130px)", color: "#111111", lineHeight: 0.88, letterSpacing: "-0.02em" }}>
              WHAT ARE YOU
              <br />
              <span style={{ color: "transparent", WebkitTextStroke: "2px #111111" }}>SIGNING?</span>
            </h1>
            <p style={{ marginTop: "24px", fontSize: "18px", fontWeight: 600, color: "#111111" }}>
              Upload, photograph, or paste any contract. Plain-language breakdown in your language.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "0px", background: "var(--bg)", border: "4px solid #111111", boxShadow: "4px 4px 0 #111111" }}>
              {([["file", FileText, "PDF / DOCX"], ["photo", Camera, "Photo / Image"], ["text", Scale, "Paste Text"]] as const).map(([m, Icon, label]) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  padding: "16px", fontSize: "14px", fontWeight: 800, textTransform: "uppercase",
                  background: mode === m ? "#111111" : "transparent",
                  color: mode === m ? "var(--bg)" : "#111111",
                  border: "none", borderRight: m !== "text" ? "2px solid #111111" : "none",
                  cursor: "pointer", transition: "all 0.1s",
                }}>
                  <Icon size={16} strokeWidth={3} /> {label}
                </button>
              ))}
            </div>

            {/* Language */}
            <div style={{ border: "4px solid #111111", padding: "20px", background: "var(--bg)", boxShadow: "4px 4px 0 #111111" }}>
              <p style={{ fontSize: "12px", fontWeight: 900, letterSpacing: "0.1em", color: "#111111", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={14} strokeWidth={3} /> OUTPUT LANGUAGE
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => setLang(l.code)} style={{
                    padding: "8px 16px", fontSize: "14px", fontWeight: 800,
                    background: lang === l.code ? "var(--accent)" : "transparent",
                    color: lang === l.code ? "#ffffff" : "#111111",
                    border: "2px solid #111111",
                    boxShadow: lang === l.code ? "2px 2px 0 #111111" : "none",
                    transform: lang === l.code ? "translate(-2px,-2px)" : "none",
                    cursor: "pointer", transition: "all 0.1s",
                  }}>{l.label}</button>
                ))}
              </div>
            </div>

            {/* Input area */}
            {mode === "text" ? (
              <div style={{ border: "4px solid #111111", background: "var(--bg)", boxShadow: "8px 8px 0 var(--accent)" }}>
                <textarea
                  placeholder="Paste the full contract text here…"
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  style={{ width: "100%", padding: "24px", fontSize: "15px", fontWeight: 500, color: "#111111", background: "transparent", border: "none", outline: "none", resize: "none", lineHeight: 1.7, boxSizing: "border-box", height: "260px", overflowY: "auto", display: "block" }}
                />
                <div style={{ padding: "16px 20px", borderTop: "2px solid #111111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: pasteText.length > 0 && pasteText.trim().length < 50 ? "#ff4d4d" : "#111111" }}>
                    {pasteText.length > 0
                      ? pasteText.trim().length < 50
                        ? `${pasteText.trim().length} chars — need ${50 - pasteText.trim().length} more`
                        : `${pasteText.trim().length} chars ✓`
                      : "Minimum 50 characters"}
                  </span>
                  <button onClick={analyseText} disabled={consumerLoading || pasteText.trim().length < 50}
                    style={{ padding: "12px 24px", fontSize: "14px", fontWeight: 900, textTransform: "uppercase", background: pasteText.trim().length < 50 ? "rgba(17,17,17,0.05)" : "var(--accent)", color: pasteText.trim().length < 50 ? "rgba(17,17,17,0.4)" : "#ffffff", border: "2px solid #111111", cursor: pasteText.trim().length < 50 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                    {consumerLoading ? <Loader2 size={16} className="anim-spin" /> : <Zap size={16} strokeWidth={3} />}
                    Analyse
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div {...getRootProps()} style={{ padding: selectedFiles.length ? "32px 40px" : "80px 40px", textAlign: "center", border: "4px solid #111111", background: "var(--bg)", boxShadow: `8px 8px 0 ${isDragActive ? "#111111" : "var(--accent)"}`, cursor: "pointer", transition: "all 0.2s" }}>
                  <input {...getInputProps()} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                    <div style={{ width: "72px", height: "72px", background: "var(--accent)", border: "4px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", transform: isDragActive ? "scale(1.08)" : "none", transition: "transform 0.2s" }}>
                      {mode === "photo" ? <Camera size={36} color="#ffffff" strokeWidth={2.5} /> : <Upload size={36} color="#ffffff" strokeWidth={2.5} />}
                    </div>
                    <div>
                      <p style={{ fontWeight: 900, fontSize: "20px", color: "#111111", marginBottom: "8px", textTransform: "uppercase" }}>
                        {isDragActive ? "Drop it!" : selectedFiles.length ? "Drop more or click to add" : mode === "photo" ? "Drop a photo or click to capture" : "Drop PDF/DOCX or click to browse"}
                      </p>
                      <p style={{ fontSize: "15px", fontWeight: 600, color: "#111111" }}>
                        {mode === "photo" ? "JPG, PNG, WEBP · Good lighting required" : "PDF or DOCX · multiple files supported"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* File list */}
                {selectedFiles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", color: "#111111" }}>
                      {selectedFiles.length} FILE{selectedFiles.length > 1 ? "S" : ""} SELECTED
                    </p>
                    {selectedFiles.map((f) => (
                      <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", border: "2px solid #111111", background: "var(--bg)", boxShadow: "2px 2px 0 #111111" }}>
                        <div style={{ width: "28px", height: "28px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FileText size={14} color="#ffffff" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: 800, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                          <p style={{ fontSize: "12px", color: "var(--text-body)", fontWeight: 600 }}>{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter(x => x.name !== f.name)); }}
                          style={{ background: "transparent", border: "2px solid #ff4d4d", padding: "4px 10px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: "#ff4d4d" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Analyse button */}
                <button onClick={runAnalysis} disabled={!selectedFiles.length || consumerLoading}
                  style={{ width: "100%", padding: "18px", fontSize: "16px", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: !selectedFiles.length || consumerLoading ? "rgba(17,17,17,0.05)" : "var(--accent)", color: !selectedFiles.length || consumerLoading ? "rgba(17,17,17,0.4)" : "#ffffff", border: "4px solid #111111", boxShadow: "4px 4px 0 #111111", cursor: !selectedFiles.length || consumerLoading ? "not-allowed" : "pointer" }}>
                  {consumerLoading ? <Loader2 size={20} className="anim-spin" /> : <Zap size={20} strokeWidth={3} />}
                  {consumerLoading ? "Analysing…" : `Analyse Contract${selectedFiles.length > 1 ? ` (${selectedFiles.length} files)` : ""}`}
                </button>
              </div>
            )}

            {/* Loading */}
            {consumerLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "60px", border: "4px solid #111111", background: "var(--bg)", boxShadow: "6px 6px 0 #111111" }}>
                <div style={{ width: "80px", height: "80px", background: "var(--accent)", border: "4px solid #111111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={36} color="#ffffff" strokeWidth={2.5} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontWeight: 900, fontSize: "20px", color: "#111111", textTransform: "uppercase" }}>Analysing…</p>
                  <p style={{ fontSize: "15px", fontWeight: 600, color: "#111111", marginTop: "8px" }}>3-stage adversarial AI pipeline running</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px", maxWidth: "320px" }}>
                    {["🔎 Stage 1 — Parsing & classifying clauses", "⚔️ Stage 2 — Adversarial risk scan", "⚡ Stage 3 — Consequence simulation & scoring"].map((s, i) => (
                      <div key={i} style={{ padding: "10px 16px", border: "1px solid #111111", fontSize: "13px", fontWeight: 600, color: "#111111" }}>{s}</div>
                    ))}
                  </div>
                </div>
                <Loader2 size={28} color="#111111" className="anim-spin" strokeWidth={3} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ display: "flex", gap: "12px", padding: "20px", background: "#ffeeee", border: "4px solid #ff4d4d", boxShadow: "4px 4px 0 #ff4d4d", alignItems: "center" }}>
                <AlertCircle size={20} color="#ff4d4d" strokeWidth={3} />
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#ff4d4d" }}>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
