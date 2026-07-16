import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OLLAMA_BASE_URL,
  getOllamaBaseUrl,
  normalizeOllamaBaseUrl,
  ollamaProvider,
  setOllamaBaseUrl,
} from "@/providers/ollama";

describe("Ollama provider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses 127.0.0.1 by default", () => {
    expect(getOllamaBaseUrl()).toBe(DEFAULT_OLLAMA_BASE_URL);

    expect(DEFAULT_OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
  });

  it("normalizes and validates the configured URL", () => {
    expect(normalizeOllamaBaseUrl(" http://127.0.0.1:11434/api/tags ")).toBe(
      "http://127.0.0.1:11434",
    );

    expect(() => normalizeOllamaBaseUrl("file:///tmp/ollama")).toThrow(/HTTP ou HTTPS/i);

    expect(() =>
      normalizeOllamaBaseUrl("http://user:password@127.0.0.1:11434"),
    ).toThrow(/identifiants/i);
  });

  it("does not contact Ollama before explicit approval", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: "qwen2.5:1.5b",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(ollamaProvider.listModels()).rejects.toThrow(
      /Connectez d’abord Ollama/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("approves the current URL after a successful explicit test", async () => {
    setOllamaBaseUrl("http://127.0.0.1:11434");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: "qwen2.5:1.5b",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(ollamaProvider.testKey("")).resolves.toEqual({
      ok: true,
    });

    await expect(ollamaProvider.listModels()).resolves.toEqual([
      {
        id: "qwen2.5:1.5b",
        label: "qwen2.5:1.5b",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("revokes approval when the URL changes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await ollamaProvider.testKey("");

    setOllamaBaseUrl("http://127.0.0.1:11435");

    await expect(ollamaProvider.listModels()).rejects.toThrow(
      /Connectez d’abord Ollama/i,
    );
  });
});
