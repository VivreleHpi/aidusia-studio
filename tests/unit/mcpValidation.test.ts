import { describe, expect, it } from "vitest";

import {
  unwrapJsonRpcResult,
  validateMcpToolArguments,
  validateMcpToolListResult,
  validateMcpToolResult,
} from "@/lib/mcp/validation";

describe("MCP runtime validation", () => {
  it("accepts a bounded valid tool list", () => {
    expect(
      validateMcpToolListResult({
        tools: [
          {
            name: "read_file",
            description: "Reads one file",
            inputSchema: {
              type: "object",
              properties: { path: { type: "string" } },
              required: ["path"],
            },
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it("rejects tools with invalid names or schemas", () => {
    expect(() =>
      validateMcpToolListResult({
        tools: [{ name: "", inputSchema: {} }],
      }),
    ).toThrow(/nom/i);

    expect(() =>
      validateMcpToolListResult({
        tools: [{ name: "bad_tool", inputSchema: [] }],
      }),
    ).toThrow(/objet/i);
  });

  it("rejects non-object tool arguments", () => {
    expect(() => validateMcpToolArguments(["unexpected"])).toThrow(/objet JSON/i);
    expect(() => validateMcpToolArguments(null)).toThrow(/objet JSON/i);
  });

  it("accepts text content and ignores unsupported content types", () => {
    expect(
      validateMcpToolResult({
        content: [
          { type: "text", text: "result" },
          { type: "image", data: "ignored" },
        ],
        isError: false,
      }),
    ).toEqual({ content: "result", isError: false });
  });

  it("rejects malformed JSON-RPC envelopes", () => {
    expect(() => unwrapJsonRpcResult({ result: {} })).toThrow(/JSON-RPC/i);

    expect(() =>
      unwrapJsonRpcResult({
        jsonrpc: "2.0",
        error: { message: "" },
      }),
    ).toThrow(/erreur JSON-RPC/i);
  });

  it("returns a valid JSON-RPC result", () => {
    expect(
      unwrapJsonRpcResult({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      }),
    ).toEqual({ tools: [] });
  });
});
