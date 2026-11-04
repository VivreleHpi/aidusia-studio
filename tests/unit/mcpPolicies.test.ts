import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMcpJournal,
  getMcpToolPolicy,
  listMcpToolPolicies,
  readMcpJournal,
  setMcpToolPolicy,
} from "@/lib/mcp/policies";

describe("mcp policies", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores per-tool policy", () => {
    setMcpToolPolicy("srv", "search", "allow");
    expect(getMcpToolPolicy("srv", "search")).toBe("allow");
    expect(listMcpToolPolicies()["srv::search"]).toBe("allow");
  });

  it("appends journal entries", () => {
    clearMcpJournal();
    expect(readMcpJournal()).toEqual([]);
  });
});
