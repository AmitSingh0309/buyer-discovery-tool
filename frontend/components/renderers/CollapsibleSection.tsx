"use client";
import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "none",
          cursor: "pointer",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "left",
          gap: 8,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {badge}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}