import { describe, expect, it } from "vitest";
import { classifyToolRisk } from "@/lib/mcp/approval";

describe("MCP approval risk classification", () => {
  it("marks actions with likely side effects as high risk", () => {
    for (const name of ["send_email", "delete_file", "transferFunds", "run_workflow"]) {
      expect(classifyToolRisk(name)).toBe("high");
    }
  });

  it("never presents an unclassified tool as safe", () => {
    expect(classifyToolRisk("read_calendar")).toBe("unknown");
  });
});
