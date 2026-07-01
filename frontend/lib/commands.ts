import type { ParsedCommand } from "./types";

const PATTERNS: Array<{ re: RegExp; type: ParsedCommand["type"] }> = [
  { re: /^(run|run\s+pipeline|pipeline|start|execute)/i, type: "RUN_PIPELINE" },
  { re: /^(find|find\s+buyers?|search\s+buyers?|discover\s+buyers?|generate\s+leads?)/i, type: "FIND_BUYERS" },
  { re: /^(ingest|upload|import|parse\s+file)/i, type: "INGEST" },
  { re: /^(show\s+leads?|leads?|list\s+leads?|results?|view\s+leads?)/i, type: "SHOW_LEADS" },
  { re: /^(status|keys?|api\s+keys?|check\s+status)/i, type: "STATUS" },
  { re: /^(config|settings?|configure|preferences?)/i, type: "CONFIG" },
  { re: /^(help|\?|commands?|what\s+can)/i, type: "HELP" },
  { re: /^(clear|reset|cls)/i, type: "CLEAR" },
];

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const args: ParsedCommand["args"] = {};

  // Extract --flag=value or --flag value patterns
  const flagRe = /--([a-z_]+)(?:=([^\s]+))?/gi;
  let match: RegExpExecArray | null;
  while ((match = flagRe.exec(trimmed)) !== null) {
    const key = match[1].replace(/-/g, "_");
    const val = match[2];
    if (val === undefined) {
      args[key] = true;
    } else if (!isNaN(Number(val))) {
      args[key] = Number(val);
    } else if (val === "true" || val === "false") {
      args[key] = val === "true";
    } else {
      args[key] = val;
    }
  }

  // Provider shorthand: "run groq" or "run with groq"
  const providerMatch = trimmed.match(/\b(groq|ollama|mock)\b/i);
  if (providerMatch) args["provider"] = providerMatch[1].toLowerCase();

  // Numeric shorthand: "run 50" or "limit 100"
  const numMatch = trimmed.match(/\b(?:limit|last|top|first)?\s*(\d+)\b/i);
  if (numMatch && !args["limit"]) args["limit"] = Number(numMatch[1]);

  for (const { re, type } of PATTERNS) {
    if (re.test(trimmed)) {
      return { type, raw: trimmed, args };
    }
  }
  return { type: "UNKNOWN", raw: trimmed, args };
}

export const HELP_ITEMS = [
  {
    cmd: "run pipeline",
    aliases: ["run", "run groq", "run ollama"],
    desc: "Normalize → Discover → Enrich → Score → Output qualified_leads.csv",
  },
  {
    cmd: "find buyers",
    aliases: ["find", "generate leads"],
    desc: "Search OSM and/or Google Places for new buyer leads",
  },
  {
    cmd: "ingest",
    aliases: ["upload", "import"],
    desc: "Parse a CSV / XLSX / DOCX / PDF buyer file with batch review",
  },
  {
    cmd: "show leads",
    aliases: ["leads", "results"],
    desc: "Display the current qualified_leads.csv as a sortable table",
  },
  {
    cmd: "status",
    aliases: ["keys", "api keys"],
    desc: "Show API key status, data file count, and cache stats",
  },
  {
    cmd: "config",
    aliases: ["settings"],
    desc: "View and edit config.json (exporter info, ICP, scoring weights)",
  },
  { cmd: "clear", aliases: ["cls", "reset"], desc: "Clear the chat thread" },
  { cmd: "help", aliases: ["?", "commands"], desc: "Show this help panel" },
];