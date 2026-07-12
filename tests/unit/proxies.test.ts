import { afterEach, describe, expect, it, vi } from "vitest";
import openAiHandler from "../../api/openai/[...path]";
import ollamaHandler from "../../api/ollama-cloud/[...path]";

afterEach(() => vi.unstubAllGlobals());

describe("Edge proxy guards", () => {
  it.each([
    [openAiHandler, "http://localhost/api/openai/models", "X-OpenAI-Key"],
    [ollamaHandler, "http://localhost/api/ollama-cloud/tags", "X-Ollama-Key"],
  ] as const)("rejects missing credentials without contacting upstream", async (handler, url) => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await handler(new Request(url));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("blocks unapproved OpenAI routes", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await openAiHandler(new Request("http://localhost/api/openai/files", {
      headers: { "X-OpenAI-Key": "test-key" },
    }));
    expect(response.status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards only an approved request and disables caching", async () => {
    const upstream = vi.fn(async () => new Response('{"data":[]}', {
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", upstream);
    const response = await openAiHandler(new Request("http://localhost/api/openai/models", {
      headers: { "X-OpenAI-Key": "test-key" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/models");
  });
});
