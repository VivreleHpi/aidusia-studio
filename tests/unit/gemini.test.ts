import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiProvider } from "@/providers/gemini";

afterEach(() => vi.unstubAllGlobals());

describe("Gemini API key transport", () => {
  it("uses x-goog-api-key and never places the key in a request URL", async () => {
    const apiKey = "gemini-secret?with=url&characters";
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({
        models: [{
          name: "models/gemini-test",
          displayName: "Gemini Test",
          supportedGenerationMethods: ["generateContent"],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await geminiProvider.listModels(apiKey);
    await geminiProvider.testKey(apiKey);
    await geminiProvider.chatStream(
      { model: "gemini-test", messages: [{ role: "user", content: "Hello" }] },
      apiKey,
      () => {},
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [input, init] of fetchMock.mock.calls) {
      const url = String(input);
      expect(url).not.toContain(apiKey);
      expect(url).not.toMatch(/[?&]key=/);
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(apiKey);
    }
  });
});
