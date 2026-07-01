"use client";
import { useEffect, useState } from "react";
import { fetchConfig, saveConfig } from "@/lib/api";
import CollapsibleSection from "@/components/renderers/CollapsibleSection";

export default function ConfigPanel() {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig().then(setCfg).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      await saveConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0" }}>
        {error ? `Error: ${error}` : "Loading config…"}
      </div>
    );
  }

  const exporter = (cfg.exporter as Record<string, unknown>) || {};
  const icp = (cfg.icp as Record<string, unknown>) || {};
  const scoring = (cfg.scoring as Record<string, unknown>) || {};
  const provider = (cfg.provider as Record<string, unknown>) || {};
  const enrichment = (cfg.enrichment as Record<string, unknown>) || {};

  const patch = (path: string[], value: unknown) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] as Record<string, unknown>;
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <CollapsibleSection title="Exporter Info" defaultOpen>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field
            label="Sender name"
            value={(exporter.sender_name as string) || ""}
            onChange={(v) => patch(["exporter", "sender_name"], v)}
          />
          <Field
            label="Sender title"
            value={(exporter.sender_title as string) || ""}
            onChange={(v) => patch(["exporter", "sender_title"], v)}
          />
          <Field
            label="Reply email"
            value={(exporter.reply_email as string) || ""}
            onChange={(v) => patch(["exporter", "reply_email"], v)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Scoring Weights">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries((scoring.weights as Record<string, number>) || {}).map(([key, val]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", width: 160 }}>{key}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={val}
                onChange={(e) => patch(["scoring", "weights", key], Number(e.target.value))}
                style={numInputStyle}
              />
              <div
                style={{
                  height: 6,
                  flex: 1,
                  background: "var(--border)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${val}%`,
                    background: "var(--accent)",
                    borderRadius: 3,
                    transition: "width 0.2s",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Provider">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Active provider
            <select
              value={(provider.provider as string) || "mock"}
              onChange={(e) => patch(["provider", "provider"], e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "5px 8px",
                color: "var(--text-primary)",
                fontSize: 13,
                outline: "none",
              }}
            >
              <option value="mock">mock (free, deterministic)</option>
              <option value="groq">groq (needs GROQ_API_KEY)</option>
              <option value="ollama">ollama (local, needs localhost:11434)</option>
            </select>
          </label>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            API keys are read from environment variables, not stored here.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="ICP — Target Markets">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
          Comma-separated country names. Score +35 when a lead matches.
        </div>
        <textarea
          value={((icp.target_markets as string[]) || []).join(", ")}
          onChange={(e) =>
            patch(
              ["icp", "target_markets"],
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            )
          }
          rows={4}
          style={textareaStyle}
        />
      </CollapsibleSection>

      <CollapsibleSection title="ICP — Buyer-type Keywords">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
          Substring matches (multilingual). Score +30 when a lead matches any keyword.
        </div>
        <textarea
          value={((icp.buyer_type_keywords as string[]) || []).join(", ")}
          onChange={(e) =>
            patch(
              ["icp", "buyer_type_keywords"],
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            )
          }
          rows={4}
          style={textareaStyle}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Enrichment Settings">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ToggleField
            label="Scrape website for email"
            value={(enrichment.scrape_website as boolean) ?? true}
            onChange={(v) => patch(["enrichment", "scrape_website"], v)}
          />
          <ToggleField
            label="Check MX records"
            value={(enrichment.check_mx as boolean) ?? true}
            onChange={(v) => patch(["enrichment", "check_mx"], v)}
          />
          <Field
            label="Request timeout (seconds)"
            value={String((enrichment.request_timeout as number) ?? 8)}
            onChange={(v) => patch(["enrichment", "request_timeout"], Number(v))}
            type="number"
          />
        </div>
      </CollapsibleSection>

      {/* Save */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "8px 18px",
            background: "var(--accent)",
            border: "none",
            borderRadius: 6,
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save config"}
        </button>
        {error && <span style={{ fontSize: 12, color: "var(--error)" }}>{error}</span>}
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          Writes to config.json on disk
        </span>
      </div>
    </div>
  );
}

const numInputStyle: React.CSSProperties = {
  width: 60,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 6px",
  color: "var(--text-primary)",
  fontSize: 12,
  outline: "none",
  textAlign: "right",
};

const textareaStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
  lineHeight: 1.6,
  resize: "vertical",
  outline: "none",
};

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "5px 8px",
          color: "var(--text-primary)",
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}