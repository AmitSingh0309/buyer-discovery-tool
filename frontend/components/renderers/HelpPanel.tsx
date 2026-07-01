import { HELP_ITEMS } from "@/lib/commands";

export default function HelpPanel() {
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
          fontWeight: 600,
          fontSize: 13,
          color: "var(--text-primary)",
        }}
      >
        Available Commands
      </div>
      <table style={{ margin: 0 }}>
        <thead>
          <tr>
            <th>Command</th>
            <th>Aliases</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {HELP_ITEMS.map((item) => (
            <tr key={item.cmd}>
              <td>
                <code
                  style={{
                    background: "var(--surface-2)",
                    color: "#93c5fd",
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {item.cmd}
                </code>
              </td>
              <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {item.aliases.join(", ")}
              </td>
              <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        Tip: Append flags like{" "}
        <code style={{ color: "#93c5fd", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
          --provider=groq
        </code>{" "}
        or{" "}
        <code style={{ color: "#93c5fd", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
          --limit=50
        </code>{" "}
        to any command.
      </div>
    </div>
  );
}