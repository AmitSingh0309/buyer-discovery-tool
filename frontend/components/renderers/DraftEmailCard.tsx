"use client";
import { useState } from "react";
import type { Lead } from "@/lib/types";
import { Badge, ScoreBadge, EmailStatusBadge } from "./Badge";

interface Props {
  lead: Lead;
  onClose?: () => void;
}

export default function DraftEmailCard({ lead, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [body, setBody] = useState(lead.draft_body);
  const [subject, setSubject] = useState(lead.draft_subject);

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const flagLines = lead.compliance_flag
    ? lead.compliance_flag.split("|").map((f) => f.trim()).filter(Boolean)
    : [];

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
              {lead.company_name}
            </span>
            <ScoreBadge score={Number(lead.fit_score)} />
            <Badge label={lead.buyer_type} variant="info" />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {lead.country}{lead.city ? ` · ${lead.city}` : ""}
            {lead.contact_name ? ` · ${lead.contact_name}` : ""}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Compliance flags */}
      {flagLines.length > 0 && (
        <div
          style={{
            padding: "8px 16px",
            background: "#1c1100",
            borderBottom: "1px solid #713f12",
          }}
        >
          {flagLines.map((f, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "#fde68a",
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <span style={{ color: "var(--warning)", flexShrink: 0 }}>⚠</span>
              {f}
            </div>
          ))}
        </div>
      )}

      {/* Contact strip */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        <ContactItem label="Email" value={lead.email || lead.email_guess || "—"} isGuess={!lead.email && !!lead.email_guess} />
        {lead.phone && <ContactItem label="Phone" value={lead.phone} />}
        {lead.website && <ContactItem label="Web" value={lead.website} isLink />}
        <span>
          <span style={{ color: "var(--text-muted)" }}>Email status: </span>
          <EmailStatusBadge status={lead.email_status} />
        </span>
      </div>

      {/* Subject */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Subject
        </label>
        {editMode ? (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "6px 8px",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4 }}>{subject}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px" }}>
        <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Body
        </label>
        {editMode ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "8px",
              color: "var(--text-primary)",
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
          />
        ) : (
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {body}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <ActionBtn onClick={copy} variant="primary">
          {copied ? "✓ Copied" : "Copy email"}
        </ActionBtn>
        <ActionBtn onClick={() => setEditMode((v) => !v)} variant="secondary">
          {editMode ? "Done editing" : "Edit draft"}
        </ActionBtn>
        {lead.score_reason && (
          <span
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}
            title="Score reason"
          >
            {lead.score_reason}
          </span>
        )}
      </div>
    </div>
  );
}

function ContactItem({
  label,
  value,
  isGuess,
  isLink,
}: {
  label: string;
  value: string;
  isGuess?: boolean;
  isLink?: boolean;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}: </span>
      {isLink ? (
        <a href={`https://${value.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}>
          {value}
        </a>
      ) : isGuess ? (
        <span style={{ color: "var(--warning)" }}>⚠ {value}</span>
      ) : (
        <span style={{ color: "var(--text-primary)" }}>{value}</span>
      )}
    </span>
  );
}

function ActionBtn({
  onClick,
  variant,
  children,
}: {
  onClick: () => void;
  variant: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 6,
        border: variant === "primary" ? "none" : "1px solid var(--border)",
        background: variant === "primary" ? "var(--accent)" : "var(--surface)",
        color: "var(--text-primary)",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
    >
      {children}
    </button>
  );
}