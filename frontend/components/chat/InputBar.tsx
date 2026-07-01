"use client";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "run pipeline",
  "show leads",
  "find buyers",
  "status",
  "ingest",
  "help",
];

export default function InputBar({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue("");
    setShowSuggestions(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const filtered =
    value.length > 0
      ? SUGGESTIONS.filter((s) => s.startsWith(value.toLowerCase()))
      : [];

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
        padding: "12px 16px 16px",
        position: "relative",
      }}
    >
      {/* Suggestions */}
      {showSuggestions && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 16,
            right: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 4,
            zIndex: 10,
          }}
        >
          {filtered.map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s);
                setShowSuggestions(false);
                textareaRef.current?.focus();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "ui-monospace, monospace",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLButtonElement).style.background = "var(--surface-2)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLButtonElement).style.background = "transparent")
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "8px 12px",
          transition: "border-color 0.15s",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
            onInput();
          }}
          onKeyDown={onKey}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={disabled ? "Processing…" : 'Type a command — try "help" or "run pipeline"'}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: "inherit",
            outline: "none",
            minHeight: 28,
            maxHeight: 160,
            overflowY: "auto",
          }}
        />

        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "none",
            background: value.trim() && !disabled ? "var(--accent)" : "var(--border)",
            color: "white",
            cursor: value.trim() && !disabled ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M7 1l6 6-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 6,
          textAlign: "center",
        }}
      >
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}