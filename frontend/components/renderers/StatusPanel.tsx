import type { ApiStatus } from "@/lib/types";
import { Badge } from "./Badge";

interface Props { status: ApiStatus; }

export default function StatusPanel({ status }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "12px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          flexWrap: "wrap",
        }}
      >
        <StatCard label="Qualified Leads" value={status.leads_count} active={status.leads_file_exists} />
        <StatCard label="Input Files" value={status.data_files.length} active={status.data_files.length > 0} />
        <StatCard label="Domain Cache" value={status.cache_entries} active={status.cache_entries > 0} />
      </div>

      {/* API Keys */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          API Keys
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(status.keys).map(([key, set]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge label={set ? "SET" : "MISSING"} variant={set ? "success" : "error"} />
              <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }}>
                {key}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                {status.key_labels[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data files */}
      {status.data_files.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
            }}
          >
            Input Files ({status.data_files.length})
          </div>
          <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {status.data_files.map((f) => (
              <Badge key={f} label={f} variant="muted" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: active ? "var(--text-primary)" : "var(--text-muted)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}