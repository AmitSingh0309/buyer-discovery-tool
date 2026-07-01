"use client";
import type { ChatMessage } from "@/lib/types";
import LeadsTable from "@/components/renderers/LeadsTable";
import DraftEmailCard from "@/components/renderers/DraftEmailCard";
import StatusPanel from "@/components/renderers/StatusPanel";
import ProgressStream from "@/components/renderers/ProgressStream";
import IngestPanel from "@/components/panels/IngestPanel";
import HelpPanel from "@/components/renderers/HelpPanel";
import ConfigPanel from "@/components/panels/ConfigPanel";

interface Props {
  message: ChatMessage;
}

function Timestamp({ date }: { date: Date }) {
  return (
    <span
      style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, flexShrink: 0 }}
    >
      {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

export default function MessageBubble({ message }: Props) {
  const { role, payload, timestamp } = message;

  if (role === "system") {
    return (
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--surface)",
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid var(--border)",
          }}
        >
          {payload.text}
        </span>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div
        className="animate-fade-in"
        style={{ display: "flex", justifyContent: "flex-end", padding: "4px 0" }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, maxWidth: "70%" }}>
          <Timestamp date={timestamp} />
          <div
            style={{
              background: "var(--user-bubble-bg)",
              border: "1px solid var(--user-bubble-border)",
              borderRadius: "12px 12px 3px 12px",
              padding: "10px 14px",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {payload.text}
          </div>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div
      className="animate-fade-in"
      style={{ display: "flex", padding: "4px 0", gap: 10 }}
    >
      {/* Avatar */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "white",
          marginTop: 2,
        }}
      >
        BD
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            Assistant
          </span>
          <Timestamp date={timestamp} />
        </div>

        <AssistantContent payload={payload} />
      </div>
    </div>
  );
}

function AssistantContent({ payload }: { payload: ChatMessage["payload"] }) {
  switch (payload.type) {
    case "text":
      return <TextBubble text={payload.text || ""} />;

    case "error":
      return (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid var(--error)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          <strong style={{ color: "var(--error)" }}>Error: </strong>
          {payload.text}
        </div>
      );

    case "leads_table":
      return <LeadsTable leads={payload.leads || []} />;

    case "draft_email":
      return payload.lead ? <DraftEmailCard lead={payload.lead} /> : null;

    case "pipeline_progress":
      return (
        <ProgressStream
          streamUrl={payload.streamUrl!}
          kind="pipeline"
          result={payload.result}
          onComplete={payload.onComplete}
        />
      );

    case "finder_progress":
      return (
        <ProgressStream
          streamUrl={payload.finderStreamUrl!}
          kind="finder"
          result={payload.result}
          onComplete={payload.onComplete}
        />
      );

    case "ingest_batch":
      return <IngestPanel initialText={payload.text} />;

    case "status_panel":
      return payload.status ? <StatusPanel status={payload.status} /> : null;

    case "config_panel":
      return <ConfigPanel />;

    case "help":
      return <HelpPanel />;

    default:
      return <TextBubble text={payload.text || ""} />;
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function TextBubble({ text }: { text: string }) {
  const html = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");

  return (
    <div
      className="prose"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "3px 12px 12px 12px",
        padding: "10px 14px",
        fontSize: 14,
        color: "var(--text-primary)",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}