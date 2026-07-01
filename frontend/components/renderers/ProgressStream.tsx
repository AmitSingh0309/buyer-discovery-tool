"use client";
import { useEffect, useRef, useState } from "react";
import { streamSSE } from "@/lib/api";
import type { PipelineResult, FinderResult } from "@/lib/types";

interface PipelineMsg {
  type: "stage" | "progress";
  stage: number;
  msg: string;
}

interface FinderMsg {
  type: "city_done" | "city_error";
  city: string;
  country: string;
  added?: number;
  raw?: number;
  msg?: string;
}

interface Props {
  streamUrl: string;
  kind: "pipeline" | "finder";
  result?: PipelineResult | FinderResult;
  onComplete?: (result: PipelineResult | FinderResult) => void;
}

const PIPELINE_STAGES = ["Normalise", "Discover Domains", "Enrich Email", "Score & Draft"];

export default function ProgressStream({ streamUrl, kind, result, onComplete }: Props) {
  const [pipelineMsgs, setPipelineMsgs] = useState<PipelineMsg[]>([]);
  const [finderMsgs, setFinderMsgs] = useState<FinderMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const didStream = useRef(false);

  useEffect(() => {
    if (didStream.current) return;
    didStream.current = true;
    const ctrl = new AbortController();

    async function go() {
      try {
        for await (const ev of streamSSE(streamUrl, ctrl.signal)) {
          if (ev.event === "message") {
            const d = ev.data as PipelineMsg | FinderMsg;
            if (kind === "pipeline") {
              setPipelineMsgs((prev) => [...prev, d as PipelineMsg]);
            } else {
              setFinderMsgs((prev) => [...prev, d as FinderMsg]);
            }
          } else if (ev.event === "done") {
            setDone(true);
            const r = (ev.data as { result?: PipelineResult | FinderResult })?.result;
            if (r) onComplete?.(r);
          } else if (ev.event === "error") {
            setError((ev.data as { error: string }).error);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Stream error");
        }
      }
    }
    go();
    return () => ctrl.abort();
  }, [streamUrl, kind]);

  if (kind === "pipeline") {
    return <PipelineProgress msgs={pipelineMsgs} result={result as PipelineResult} done={done || !!result} error={error} />;
  }
  return <FinderProgress msgs={finderMsgs} result={result as FinderResult} done={done || !!result} error={error} />;
}

function PipelineProgress({
  msgs,
  result,
  done,
  error,
}: {
  msgs: PipelineMsg[];
  result?: PipelineResult;
  done: boolean;
  error: string | null;
}) {
  const activeStage = msgs.filter((m) => m.type === "stage").length;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Stage progress bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {PIPELINE_STAGES.map((label, i) => {
            const active = i + 1 === activeStage;
            const complete = i + 1 < activeStage || done;
            return (
              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: 3,
                    borderRadius: 999,
                    background: complete
                      ? "var(--success)"
                      : active
                      ? "var(--accent)"
                      : "var(--border)",
                    marginBottom: 4,
                    transition: "background 0.3s",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: complete
                      ? "var(--success)"
                      : active
                      ? "var(--accent)"
                      : "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log */}
      <div
        style={{
          padding: "10px 14px",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          lineHeight: 1.7,
          maxHeight: 200,
          overflowY: "auto",
          color: "var(--text-secondary)",
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              color: m.type === "stage" ? "var(--accent)" : "var(--text-secondary)",
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--text-muted)", userSelect: "none" }}>
              {m.type === "stage" ? `[Stage ${m.stage}]` : "  ↳"}
            </span>
            <span>{m.msg}</span>
          </div>
        ))}
        {!done && !error && <div style={{ color: "var(--text-muted)" }}>…working</div>}
        {error && <div style={{ color: "var(--error)" }}>✕ {error}</div>}
      </div>

      {/* Result summary */}
      {result && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <ResultStat label="Qualified leads" value={(result as PipelineResult).total} color="var(--success)" />
          <ResultStat label="Compliance flags" value={(result as PipelineResult).flagged} color="var(--warning)" />
          <ResultStat label="Verify email" value={(result as PipelineResult).needs_verify} color="var(--warning)" />
          <ResultStat label="Need email" value={(result as PipelineResult).needs_email} color="var(--error)" />
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
            Provider: {(result as PipelineResult).provider_used}
          </span>
        </div>
      )}
    </div>
  );
}

function FinderProgress({
  msgs,
  result,
  done,
  error,
}: {
  msgs: FinderMsg[];
  result?: FinderResult;
  done: boolean;
  error: string | null;
}) {
  const totalAdded = msgs.reduce((acc, m) => acc + (m.added || 0), 0);

  return (
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
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {done ? "✓" : <Spinner />} Buyer Finder
        {totalAdded > 0 && (
          <span style={{ fontWeight: 400, color: "var(--success)", fontSize: 12 }}>
            +{totalAdded} new
          </span>
        )}
      </div>

      <div
        style={{
          padding: "10px 14px",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          lineHeight: 1.7,
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                color:
                  m.type === "city_error"
                    ? "var(--error)"
                    : m.added
                    ? "var(--success)"
                    : "var(--text-muted)",
              }}
            >
              {m.type === "city_error" ? "✕" : `+${m.added}`}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {m.city}, {m.country}
              {m.raw !== undefined && ` (${m.raw} raw)`}
              {m.msg && ` — ${m.msg}`}
            </span>
          </div>
        ))}
        {!done && !error && <div style={{ color: "var(--text-muted)" }}>…searching</div>}
        {error && <div style={{ color: "var(--error)" }}>✕ {error}</div>}
      </div>

      {result && (
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--success)",
          }}
        >
          ✓ Done — {(result as FinderResult).new_buyers} new buyers written to{" "}
          <code style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {(result as FinderResult).out_file}
          </code>
          . Run <strong>run pipeline</strong> to process them.
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}: </span>
      <span style={{ fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</span>
    </span>
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="6"
        cy="6"
        r="5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeDasharray="20 10"
      />
    </svg>
  );
}