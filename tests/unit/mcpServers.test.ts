import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addMcpServer,
  listMcpServers,
  MCP_SERVERS_STORAGE_KEY,
  removeMcpServer,
  setMcpServerHeaders,
} from "@/lib/mcp/servers";

describe("MCP server storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("never stores MCP header values in localStorage", () => {
    addMcpServer({
      name: "Secure MCP",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer super-secret" },
    });

    const persisted = localStorage.getItem(MCP_SERVERS_STORAGE_KEY) ?? "";

    expect(persisted).not.toContain("super-secret");
    expect(persisted).not.toContain("Authorization");

    const sessionValues = Object.keys(sessionStorage).map((key) =>
      sessionStorage.getItem(key),
    );

    expect(sessionValues.join("")).toContain("Bearer super-secret");
  });

  it("hydrates metadata with session-only headers", () => {
    const created = addMcpServer({
      name: "Secure MCP",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer session-secret" },
    });

    const [server] = listMcpServers();

    expect(server).toEqual({
      id: created.id,
      name: "Secure MCP",
      url: "https://example.com/mcp",
      requiresSecret: true,
      headers: { Authorization: "Bearer session-secret" },
    });
  });

  it("migrates legacy localStorage entries and removes their headers", () => {
    localStorage.setItem(
      MCP_SERVERS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-server",
          name: "Legacy",
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer legacy-secret" },
        },
      ]),
    );

    const servers = listMcpServers();

    expect(servers[0]?.headers).toEqual({ Authorization: "Bearer legacy-secret" });

    const migrated = localStorage.getItem(MCP_SERVERS_STORAGE_KEY) ?? "";

    expect(migrated).not.toContain("legacy-secret");
    expect(migrated).not.toContain("Authorization");
  });

  it("marks a connector as missing its secret after session storage is cleared", () => {
    addMcpServer({
      name: "Secure MCP",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer temporary" },
    });

    sessionStorage.clear();

    const [server] = listMcpServers();

    expect(server?.requiresSecret).toBe(true);
    expect(server?.headers).toBeUndefined();
  });

  it("updates and removes secrets independently from metadata", () => {
    const server = addMcpServer({
      name: "Secure MCP",
      url: "https://example.com/mcp",
    });

    setMcpServerHeaders(server.id, { Authorization: "Bearer replacement" });

    expect(listMcpServers()[0]?.headers).toEqual({
      Authorization: "Bearer replacement",
    });

    removeMcpServer(server.id);

    expect(listMcpServers()).toEqual([]);
    expect(Object.keys(sessionStorage)).toEqual([]);
  });

  it("rejects managed or injection-prone headers", () => {
    expect(() =>
      addMcpServer({
        name: "Bad MCP",
        url: "https://example.com/mcp",
        headers: { "Content-Type": "text/plain" },
      }),
    ).toThrow(/géré par l’application/i);

    expect(() =>
      addMcpServer({
        name: "Bad MCP",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer value\r\nInjected: yes" },
      }),
    ).toThrow(/valeur invalide/i);
  });
});
