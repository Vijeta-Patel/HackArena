"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

const LINKS = [
  { href: "/enterprise", label: "Enterprise" },
  { href: "/consumer",   label: "Consumer" },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "22px 36px",
        /* no border, no background — pure minimal */
      }}
    >
      {/* Wordmark */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <span
          className="font-display"
          style={{
            fontSize: "26px",
            color: "var(--accent)",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          CAVEAT
        </span>
      </Link>

      {/* Center nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {LINKS.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "8px 18px",
                borderRadius: "100px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                color: active ? "var(--bg)" : "var(--accent)",
                background: active ? "var(--accent)" : "transparent",
                border: active ? "none" : "none",
                transition: "all 0.2s",
                opacity: active ? 1 : 0.7,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <a href="/extension.zip" download="Caveat-Extension.zip">
        <button
          className="btn-primary"
          style={{ fontSize: "13px", padding: "10px 22px", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <ExternalLink size={14} /> Extension
        </button>
      </a>
    </nav>
  );
}
