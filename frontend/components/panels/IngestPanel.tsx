"use client";
import { useRef, useState } from "react";
import { uploadIngest, approveIngestBatch, abortIngest } from "@/lib/api";
import type { IngestBatch } from "@/lib/types";
import { BandBadge, NeedsEnrichmentBadge } from "@/components/renderers/Badge";

interface Props {
  initialText?: string;
}

const ACCEPTED = ".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.docx,.pdf";

export default function IngestPanel({ initialText }: Props) {
  const [batch, setBatch] = useState<IngestBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [batchSize, setBatchSize] = useState(25);
  const [autoApprove, setAutoApprove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const result = await uploadIngest(file, batchSize, autoApprove);
      setBatch(result);
      if (result.done) setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!batch) return;
    setLoading(true);
    try {
      const next = await approveIngestBatch(batch.job_id);
      setBatch(next);
      if (next.done) setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoading(false);
    }
  };

  const abort = async () => {
    if (batch) await abortIngest(batch.job_id);
    setBatch(null);
    setDone(false);
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!batch && (
        <>
          {/* Upload zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: "2px dashed var(--border)",
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 13,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Drop buyer file here or click to browse
            </div>
            <div style={{ fontSize: 11 }}>
              CSV · XLSX · DOCX · PDF — max 20 MB
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
          </div>

          {/* Options */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12 }}>
            <label style={{ color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center" }}>
              Batch size:
              <input
                type="number"
                min={5}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                style={{
                  width: 56,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "3px 6px",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </label>
            <label style={{ color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
              />
              Auto-approve all batches
            </label>
          </div>
        </>
      )}

      {loading && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>Processing…</div>
      )}

      {error && (
        <div
          style={{
            background: "#1f0f0f",
            border: "1px solid var(--error)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 12,
            color: "#fca5a5",
          }}
        >
          ✕ {error}
        </div>
      )}

      {batch && (
        <>
          {/* Header mapping */}
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
              Column Mapping — {batch.filename} ({batch.fmt})
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 2,
                padding: "8px 14px",
                maxHeight: 160,
                overflowY: "auto",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {Object.entries(batch.mapping).map(([orig, mapped]) => (
                <div key={orig} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {orig}
                  </span>
                  <span style={{ color: "var(--border-light)" }}>→</span>
                  <span
                    style={{
                      color: mapped === "(ignored)" ? "var(--error)" : "var(--success)",
                    }}
                  >
                    {mapped}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Batch table */}
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
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Batch {batch.current_batch} of {batch.n_batches} — {batch.total_rows} total rows
              </span>
              {done && (
                <span style={{ color: "var(--success)", fontSize: 11 }}>
                  ✓ Written to {batch.out_path}
                </span>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Score</th>
                    <th>Company</th>
                    <th>Country</th>
                    <th>Enrichment</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.batch.map((row, i) => (
                    <tr key={i}>
                      <td><BandBadge band={row.band} /></td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.score}</td>
                      <td>{row.company_name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{row.country || "—"}</td>
                      <td><NeedsEnrichmentBadge value={row.needs_enrichment} /></td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          {!done && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={approve}
                disabled={loading}
                style={{
                  padding: "8px 18px",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 6,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {batch.current_batch < batch.n_batches
                  ? `Approve & load batch ${batch.current_batch + 1}`
                  : "Approve final batch"}
              </button>
              <button
                onClick={abort}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-muted)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Stop
              </button>
            </div>
          )}

          {done && (
            <div
              style={{
                padding: "10px 14px",
                background: "#052e16",
                border: "1px solid #166534",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--success)",
              }}
            >
              ✓ All {batch.n_batches} batches written to{" "}
              <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                {batch.out_path}
              </code>
              . Type <strong>run pipeline</strong> to discover domains, enrich emails, and score leads.
            </div>
          )}
        </>
      )}
    </div>
  );
}