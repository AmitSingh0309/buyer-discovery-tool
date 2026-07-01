"use client";
import { useEffect, useCallback } from "react";
import ChatThread from "@/components/chat/ChatThread";
import InputBar from "@/components/chat/InputBar";
import { useChat } from "@/lib/useChat";

export default function Home() {
  const { messages, isLoading, handleCommand } = useChat();

  // Allow quick-action buttons in ChatThread's EmptyState to submit commands
  const onQuickAction = useCallback(
    (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (cmd) handleCommand(cmd);
    },
    [handleCommand]
  );

  useEffect(() => {
    window.addEventListener("chat:command", onQuickAction);
    return () => window.removeEventListener("chat:command", onQuickAction);
  }, [onQuickAction]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: 900,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "white",
            }}
          >
            BD
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Buyer Discovery
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Maharath Exim — International Lead Intelligence
            </div>
          </div>
        </div>
        <QuickActions onCommand={handleCommand} />
      </header>

      {/* Chat */}
      <ChatThread messages={messages} isLoading={isLoading} />

      {/* Input */}
      <InputBar onSubmit={handleCommand} disabled={isLoading} />
    </div>
  );
}

function QuickActions({ onCommand }: { onCommand: (cmd: string) => void }) {
  const actions = [
    { label: "Pipeline", cmd: "run pipeline" },
    { label: "Leads", cmd: "show leads" },
    { label: "Status", cmd: "status" },
    { label: "Help", cmd: "help" },
  ];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {actions.map(({ label, cmd }) => (
        <button
          key={cmd}
          onClick={() => onCommand(cmd)}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
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
          {label}
        </button>
      ))}
    </div>
  );
}