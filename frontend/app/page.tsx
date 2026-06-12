"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2, User, Puzzle, ArrowRight,
  Shield, AlertTriangle, Eye, Check, Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const TICKS = [
  "DPDP ACT 2023", "GDPR", "RBI GUIDELINES", "7 AI AGENTS",
  "REAL-TIME SSE", "MULTILINGUAL", "CONTRADICTION DETECTION",
  "GITHUB PR", "SLACK ALERTS", "VECTOR MEMORY", "CHROMADB", "LANGGRAPH",
];

const AGENTS = [
  { id: "1",  name: "Ingestor",   desc: "File validation · SHA-256 hash · job ID" },
  { id: "2A", name: "Extractor",  desc: "PDF/DOCX parsing → ClauseManifest" },
  { id: "2B", name: "Reg Loader", desc: "DPDP/GDPR/RBI corpus + live web search" },
  { id: "2C", name: "Memory",     desc: "ChromaDB embed · contradiction detect" },
  { id: "3",  name: "Classifier", desc: "Risk level + confidence · reflection loop" },
  { id: "5",  name: "Redliner",   desc: "Compliant clause replacement drafts" },
  { id: "6",  name: "Reporter",   desc: "GitHub PR · Slack · SSE pipeline_complete" },
];

export default function Home() {
  const [activeAgent, setActiveAgent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveAgent(p => (p + 1) % AGENTS.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />

      <main style={{ position: "relative", zIndex: 10, background: "var(--bg)", marginBottom: "100vh", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
      {/* HERO */}
      <section style={{ height: "100vh", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          transform: "scaleX(0.55)",
          transformOrigin: "center bottom",
          userSelect: "none",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}>
          {/* Row 1: THE FINE */}
          <div style={{ lineHeight: 0.82, position: "relative", display: "block" }}>
            <span className="font-display" style={{
              fontSize: "20vw", color: "var(--accent)",
              WebkitTextStroke: "2px var(--accent)",
            }}>THE</span>
            <span style={{ display: "inline-block", width: "2vw" }} />
            <span className="font-display" style={{
              fontSize: "20vw", color: "var(--accent)",
              display: "inline-block", transform: "skewX(-8deg)",
              WebkitTextStroke: "2px var(--accent)", // Makes the text physically bolder
            }}>FINE</span>
          </div>
          
          {/* Row 2: PRINT FINALLY. */}
          <div style={{ lineHeight: 0.82, position: "relative", display: "block", marginTop: "2vw" }}>
            <span className="font-display" style={{
              fontSize: "19vw", color: "var(--accent)",
              WebkitTextStroke: "2px var(--accent)",
            }}>PRINT</span>
            <span style={{ display: "inline-block", width: "1.5vw" }} />
            <span className="font-display" style={{
              fontSize: "19vw", color: "var(--accent)",
              WebkitTextStroke: "2px var(--accent)",
            }}>FINALLY.</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          LIGHT THEME CONTENT (Everything below Hero)
      ══════════════════════════════════════════ */}
      <div className="theme-light">
      
      {/* CTA strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "14px",
          padding: "48px 20px",
        }}
      >
        <Link href="/enterprise">
          <button className="btn-primary">
            <Building2 size={15} />
            Enterprise Dashboard
            <ArrowRight size={14} />
          </button>
        </Link>
        <Link href="/consumer">
          <button className="btn-ghost">
            <User size={15} />
            Consumer Tool
          </button>
        </Link>
      </div>

      {/* ══════════════════════════════════════════
          THREE SURFACES
      ══════════════════════════════════════════ */}
      <section style={{ padding: "120px 36px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ marginBottom: "80px" }}>
            <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.15em", color: "var(--accent)", marginBottom: "16px", textTransform: "uppercase" }}>THREE DELIVERY SURFACES</p>
            <h2
              className="font-display"
              style={{
                fontSize: "clamp(80px, 14vw, 180px)",
                color: "var(--accent)",
                lineHeight: 0.82,
                letterSpacing: "-0.02em",
                transform: "scaleX(0.8)",
                transformOrigin: "left",
              }}
            >
              ONE<br />
              <span style={{ color: "var(--text-muted)", WebkitTextStroke: "1px var(--text-muted)" }}>INTELLIGENCE.</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {[
              { icon: Building2, label: "Enterprise", title: "Pipeline", desc: "7-agent LangGraph orchestration. Risk classification, redlining, GitHub PR, Slack alerts — all under 45 seconds.", href: "/enterprise", cta: "Open Dashboard" },
              { icon: User, label: "Consumer", title: "Clarity", desc: "Photograph a physical document. Plain-language breakdown in Hindi, Kannada, Tamil, Telugu or 5 more languages.", href: "/consumer", cta: "Try It Free" },
              { icon: Puzzle, label: "Browser", title: "Extension", desc: "MutationObserver detects every ToS wall. Icon glows amber → red. Sidebar analysis without leaving the page.", href: "/extension.zip", cta: "Download Extension" },
            ].map((card, i) => (
              <div key={i} style={{ 
                padding: "48px 40px", 
                display: "flex", 
                flexDirection: "column", 
                gap: "24px",
                background: "var(--bg-card)",
                border: "3px solid var(--accent)",
                borderBottom: "10px solid var(--accent)", // Brutalist heavy bottom border
                borderRight: "6px solid var(--accent)",
              }}>
                <div style={{ width: "64px", height: "64px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <card.icon size={28} color="var(--bg)" strokeWidth={2.5} />
                </div>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.15em", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>{card.label}</p>
                  <h3 className="font-display" style={{ fontSize: "clamp(48px, 5vw, 64px)", color: "var(--accent)", lineHeight: 0.9 }}>{card.title}</h3>
                </div>
                <p style={{ fontSize: "16px", lineHeight: "1.6", color: "var(--text-body)", flex: 1, fontWeight: 500 }}>{card.desc}</p>
                <a href={card.href} download={card.href === "/extension.zip" ? "LexGuard-Extension.zip" : undefined} style={{ alignSelf: "flex-start", textDecoration: "none" }}>
                  <button style={{ 
                    fontSize: "14px", fontWeight: 800, padding: "16px 28px", 
                    background: "var(--bg)", color: "var(--accent)", 
                    border: "3px solid var(--accent)", display: "inline-flex", alignItems: "center", gap: "10px",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {card.cta} <ArrowRight size={16} strokeWidth={3} />
                  </button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7 AGENTS
      ══════════════════════════════════════════ */}
      <section style={{ padding: "120px 36px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.15em", color: "var(--accent)", marginBottom: "16px", textTransform: "uppercase" }}>LANGGRAPH ORCHESTRATION</p>
            <h2 className="font-display" style={{ 
              fontSize: "clamp(80px, 11vw, 150px)", 
              lineHeight: 1.0, 
              letterSpacing: "-0.02em", 
              color: "#111111", 
              marginBottom: "32px",
              transform: "scaleX(0.8)",
              transformOrigin: "left",
            }}>
              7<br />
              <span style={{ color: "transparent", WebkitTextStroke: "3px var(--accent)" }}>AGENTS.</span><br />
              1<br />
              <span style={{ color: "transparent", WebkitTextStroke: "3px var(--accent)" }}>PIPELINE.</span>
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--text-body)", maxWidth: "380px", fontWeight: 500 }}>
              Parallel fan-out for extraction, regulation loading, and memory scanning. Risk report in under 45 seconds.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {AGENTS.map((agent, i) => (
              <div key={agent.id} onClick={() => setActiveAgent(i)} style={{
                display: "flex", alignItems: "center", gap: "20px", padding: "20px 24px",
                cursor: "pointer", transition: "all 0.2s ease",
                background: "var(--bg-card)",
                border: activeAgent === i ? "3px solid var(--accent)" : "2px solid var(--border)",
                boxShadow: activeAgent === i ? "8px 8px 0 var(--accent)" : "none",
                transform: activeAgent === i ? "translate(-4px, -4px)" : "translate(0, 0)",
              }}>
                <div style={{
                  width: "44px", height: "44px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", fontWeight: 900, flexShrink: 0,
                  background: activeAgent === i ? "var(--accent)" : "var(--accent-muted)",
                  color: activeAgent === i ? "var(--bg)" : "var(--accent)",
                  border: activeAgent === i ? "none" : "2px solid var(--accent)",
                  transition: "all 0.2s",
                }}>
                  {agent.id}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "16px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: activeAgent === i ? "var(--accent)" : "#111111" }}>{agent.name}</p>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 }}>{agent.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MEMORY
      ══════════════════════════════════════════ */}
      <section style={{ padding: "120px 36px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ 
            padding: "80px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center",
            background: "var(--bg)", 
            border: "4px solid #111111", 
            borderBottom: "16px solid #111111", 
            borderRight: "10px solid #111111"
          }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.15em", color: "var(--accent)", marginBottom: "16px", textTransform: "uppercase" }}>CHROMADB VECTOR MEMORY</p>
              <h2 className="font-display" style={{ 
                fontSize: "clamp(64px, 8vw, 120px)", lineHeight: 1.0, color: "#111111", marginBottom: "32px", letterSpacing: "-0.02em",
                transform: "scaleX(0.8)", transformOrigin: "left"
              }}>
                MEMORY<br />THAT<br />
                <span style={{ color: "transparent", WebkitTextStroke: "3px var(--accent)" }}>NEVER</span><br />
                <span style={{ color: "transparent", WebkitTextStroke: "3px var(--accent)" }}>FORGETS.</span>
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {[
                  { text: "Cross-document contradiction detection" },
                  { text: "Historical flag inheritance across projects" },
                  { text: "RAG Q&A over all project contracts" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "12px", height: "12px", background: "var(--accent)", flexShrink: 0 }} />
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "#111111", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {[
                { label: "org_acme_global",       count: 847, max: 900 },
                { label: "org_acme_proj_vendors",  count: 124, max: 900 },
                { label: "org_acme_proj_saas",     count: 53,  max: 900 },
              ].map((col, i) => (
                <div key={i} style={{ padding: "20px 24px", background: "var(--bg-card)", border: "3px solid #111111", borderBottom: "8px solid #111111" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "bold", color: "#111111", textTransform: "uppercase" }}>{col.label}</span>
                    <span style={{ fontSize: "14px", fontWeight: 900, color: "var(--accent)" }}>{col.count} CLAUSES</span>
                  </div>
                  <div style={{ height: "10px", background: "var(--border)", border: "1px solid #111111" }}>
                    <div style={{ height: "100%", width: `${(col.count / col.max) * 100}%`, background: "var(--accent)", borderRight: "2px solid #111111" }} />
                  </div>
                </div>
              ))}
              <div style={{ padding: "20px 24px", background: "#111111", color: "var(--bg)", display: "flex", gap: "12px", alignItems: "center", borderBottom: "8px solid var(--accent)" }}>
                <Check size={20} strokeWidth={4} />
                <span style={{ fontSize: "14px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>GitHub PR #47 created · Slack sent · 38.4s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      </div> {/* End of theme-light */}
      </main>

      {/* ══════════════════════════════════════════
          MASSIVE FOOTER (Dark Theme Inherited)
      ══════════════════════════════════════════ */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, width: "100%", height: "100vh", zIndex: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 36px 40px" }}>
        
        <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "60px", flex: 1, justifyContent: "center" }}>
          
          {/* MULTILINGUAL BLOCK */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.15em", color: "var(--accent)", marginBottom: "12px", textTransform: "uppercase" }}>MULTILINGUAL BY DESIGN</p>
              <h2 className="font-display" style={{ fontSize: "clamp(48px, 6vw, 100px)", lineHeight: 1.0, color: "#ffffff", marginBottom: "16px", transform: "scaleX(0.8)", transformOrigin: "left" }}>
                BUILT FOR<br />
                <span style={{ color: "transparent", WebkitTextStroke: "2px var(--accent)" }}>BHARAT.</span>
              </h2>
              <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", maxWidth: "400px", lineHeight: 1.6, fontWeight: 500 }}>
                Photograph a physical paper in any Indian script. Adversarial analysis delivered in your language.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignContent: "flex-start" }}>
              {[["हिंदी", true],["ಕನ್ನಡ", true],["தமிழ்", true],["తెలుగు", true],["മലയാളം", true],["বাংলা", true],["English", true],["मराठी", true]].map(([lang, isIndian], i) => (
                <div key={i} style={{ 
                  padding: "16px 28px", fontSize: "18px", fontWeight: 800, textTransform: "uppercase",
                  background: isIndian ? "var(--accent)" : "transparent", 
                  color: isIndian ? "var(--bg)" : "rgba(255,255,255,0.5)",
                  border: isIndian ? "none" : "2px solid rgba(255,255,255,0.2)",
                }}>
                  {lang}
                </div>
              ))}
            </div>
          </div>

          {/* READY TO ANALYSE & LINKS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "32px", marginTop: "40px" }}>
            <h2 className="font-display" style={{ fontSize: "clamp(64px, 10vw, 150px)", lineHeight: 1.0, color: "#ffffff", letterSpacing: "-0.02em", transform: "scaleX(0.8)" }}>
              READY TO<br />
              <span style={{ color: "var(--accent)" }}>ANALYSE?</span>
            </h2>
            
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/enterprise">
                <button style={{ padding: "16px 32px", background: "var(--accent)", color: "var(--bg)", border: "none", fontSize: "14px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Building2 size={18} strokeWidth={3} /> Enterprise Dashboard
                </button>
              </Link>
              <Link href="/consumer">
                <button style={{ padding: "16px 32px", background: "transparent", color: "var(--accent)", border: "3px solid var(--accent)", fontSize: "14px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                  <User size={18} strokeWidth={3} /> Consumer Tool
                </button>
              </Link>
              <Link href="/extension.zip">
                <button style={{ padding: "16px 32px", background: "transparent", color: "#ffffff", border: "3px solid rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Puzzle size={18} strokeWidth={3} /> Download Extension
                </button>
              </Link>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
