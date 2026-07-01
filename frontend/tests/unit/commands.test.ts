import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/commands";

describe("parseCommand", () => {
  const cases: Array<[string, string]> = [
    ["run", "RUN_PIPELINE"],
    ["run pipeline", "RUN_PIPELINE"],
    ["pipeline", "RUN_PIPELINE"],
    ["start", "RUN_PIPELINE"],
    ["execute", "RUN_PIPELINE"],
    ["find buyers", "FIND_BUYERS"],
    ["find", "FIND_BUYERS"],
    ["generate leads", "FIND_BUYERS"],
    ["search buyers", "FIND_BUYERS"],
    ["ingest", "INGEST"],
    ["upload buyers.xlsx", "INGEST"],
    ["import", "INGEST"],
    ["show leads", "SHOW_LEADS"],
    ["leads", "SHOW_LEADS"],
    ["results", "SHOW_LEADS"],
    ["list leads", "SHOW_LEADS"],
    ["view leads", "SHOW_LEADS"],
    ["status", "STATUS"],
    ["keys", "STATUS"],
    ["api keys", "STATUS"],
    ["config", "CONFIG"],
    ["settings", "CONFIG"],
    ["help", "HELP"],
    ["?", "HELP"],
    ["commands", "HELP"],
    ["clear", "CLEAR"],
    ["cls", "CLEAR"],
    ["reset", "CLEAR"],
    ["nonsense xyz", "UNKNOWN"],
  ];

  it.each(cases)("'%s' → %s", (input, expected) => {
    expect(parseCommand(input).type).toBe(expected);
  });

  it("extracts provider flag", () => {
    const cmd = parseCommand("run --provider=groq");
    expect(cmd.args.provider).toBe("groq");
  });

  it("extracts limit flag", () => {
    const cmd = parseCommand("run pipeline --limit=50");
    expect(cmd.args.limit).toBe(50);
  });

  it("extracts boolean flag", () => {
    const cmd = parseCommand("run --no_scrape");
    expect(cmd.args.no_scrape).toBe(true);
  });

  it("extracts provider from shorthand 'run groq'", () => {
    const cmd = parseCommand("run groq");
    expect(cmd.args.provider).toBe("groq");
    expect(cmd.type).toBe("RUN_PIPELINE");
  });

  it("is case-insensitive", () => {
    expect(parseCommand("RUN PIPELINE").type).toBe("RUN_PIPELINE");
    expect(parseCommand("Find Buyers").type).toBe("FIND_BUYERS");
  });

  it("stores raw input", () => {
    const cmd = parseCommand("show leads");
    expect(cmd.raw).toBe("show leads");
  });
});