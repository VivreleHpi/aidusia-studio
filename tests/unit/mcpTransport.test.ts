import { afterEach, describe, expect, it, vi } from "vitest";
import { initialize, listTools, mcpTransportViolation } from "@/lib/mcp/client";
import type { McpServer } from "@/lib/mcp/types";

function server(url: string, headers?: Record<string, string>): McpServer {
  return { id: "test", name: "Test MCP", url, headers };
}

afterEach(() => vi.unstubAllGlobals());

describe("MCP transport policy", () => {
  it("requires HTTPS for remote servers", () => {
    expect(mcpTransportViolation(server("http://example.com/mcp"))).toBe("https-required");
    expect(mcpTransportViolation(server("https://example.com/mcp", { Authorization: "Bearer test" }))).toBeNull();
  });

  it("allows HTTP only on loopback and without configured headers", () => {
    expect(mcpTransportViolation(server("http://localhost:3000/mcp"))).toBeNull();
    expect(mcpTransportViolation(server("http://127.0.0.1:3000/mcp"))).toBeNull();
    expect(mcpTransportViolation(server("http://[::1]:3000/mcp"))).toBeNull();
    expect(mcpTransportViolation(server("http://localhost:3000/mcp", { Authorization: "Bearer test" })))
      .toBe("headers-require-https");
    expect(mcpTransportViolation(server("http://user:password@localhost:3000/mcp")))
      .toBe("headers-require-https");
    expect(mcpTransportViolation(server("http://localhost:3000/mcp?token=test")))
      .toBe("headers-require-https");
  });

  it("rejects an unsafe server before any network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listTools(server("http://192.168.1.20:3000/mcp"))).rejects.toThrow(/HTTPS/);
    await expect(initialize(server("http://localhost:3000/mcp", { Authorization: "Bearer test" })))
      .rejects.toThrow(/HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
