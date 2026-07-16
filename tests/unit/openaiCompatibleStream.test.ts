import { describe, expect, it, vi } from "vitest";

import { readOpenAiCompatibleStream } from "@/providers/openaiCompatibleStream";

describe("readOpenAiCompatibleStream", () => {
  it("refuses malformed tool arguments instead of using an empty object", async () => {
    const response = new Response(
      [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"delete_file","arguments":"{\\"path\\":"}}]},"finish_reason":null}]}',
        "",
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        "",
      ].join("\n"),
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
      },
    );

    const onChunk = vi.fn();

    await expect(readOpenAiCompatibleStream(response, onChunk)).rejects.toThrow(
      /arguments JSON invalides/i,
    );

    expect(onChunk).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool_call",
      }),
    );
  });

  it("supports CRLF events and valid fragmented tool arguments", async () => {
    const response = new Response(
      [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"read_file","arguments":"{\\"pa"}}]},"finish_reason":null}]}',
        "",
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"README.md\\"}"}}]},"finish_reason":"tool_calls"}]}',
        "",
        "data: [DONE]",
        "",
      ].join("\r\n"),
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
      },
    );

    const onChunk = vi.fn();

    await readOpenAiCompatibleStream(response, onChunk);

    expect(onChunk).toHaveBeenCalledWith({
      type: "tool_call",
      call: {
        id: "call-1",
        name: "read_file",
        args: {
          path: "README.md",
        },
      },
    });
  });
});
