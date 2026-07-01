"use client";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
}

function TypingIndicator() {
  return (
    <div className="animate-fade-in" style={{ display: "flex", gap: 10, padding: "4px 0" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "3px 12px 12px 12px",
          padding: "12px 16px",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "40px 20px",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          color: "white",
        }}
      >
        BD
      </div>

      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          Buyer Discovery
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>
          Find, enrich, and qualify international buyers for Indian handicraft exports.
          Type a command below to get started.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          width: "100%",
          maxWidth: 480,
        }}
      >
        {[
          { cmd: "run pipeline", label: "Run Pipeline", icon: "▶" },
          { cmd: "show leads", label: "View Leads", icon: "📋" },
          { cmd: "find buyers", label: "Find Buyers", icon: "🔍" },
          { cmd: "status", label: "Check Status", icon: "⚡" },
        ].map(({ cmd, label, icon }) => (
          <button
            key={cmd}
            data-command={cmd}
            onClick={() => {
              // Dispatch custom event so parent can pick it up
              window.dispatchEvent(new CustomEvent("chat:command", { detail: cmd }));
            }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              textAlign: "left",
              transition: "border-color 0.15s, color 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatThread({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        padding: "16px 20px",
        gap: 8,
      }}
    >
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && <TypingIndicator />}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}