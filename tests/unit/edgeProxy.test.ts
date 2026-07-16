import { afterEach, describe, expect, it, vi } from "vitest";
import { createEdgeProxyHandler, limitResponseStream } from "../../api/_shared/edgeProxy";

const SECRET = "test-secret-never-use";

const handler = createEdgeProxyHandler({
  requestPathPrefix: "/api/test/",
  upstreamBaseUrl: "https://upstream.example/v1/",
  secretHeader: "X-Test-Key",
  missingSecretMessage: "Clé manquante",
  invalidSecretMessage: "Clé invalide",
  unreachableMessage: "Fournisseur injoignable",
  timeoutMessage: "Délai dépassé",
  routes: {
    models: {
      methods: ["GET"],
      timeoutMs: 100,
      maxBodyBytes: 0,
      maxResponseBytes: 32,
      responseContentTypes: ["application/json"],
    },
    chat: {
      methods: ["POST"],
      timeoutMs: 100,
      maxBodyBytes: 16,
      maxResponseBytes: 32,
      responseContentTypes: ["application/json", "text/event-stream"],
    },
  },
});

function request(
  path = "models",
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  if (!headers.has("X-Test-Key")) headers.set("X-Test-Key", SECRET);
  return new Request(`https://app.example/api/test/${path}`, { ...init, headers });
}

function jsonUpstream(body = '{"ok":true}'): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("edge proxy guard", () => {
  it("rejects a different origin and cross-site fetch context", async () => {
    expect(await handler(request("models", { headers: { Origin: "https://evil.example" } })))
      .toHaveProperty("status", 403);
    expect(await handler(request("models", { headers: { "Sec-Fetch-Site": "cross-site" } })))
      .toHaveProperty("status", 403);
  });

  it("rejects unknown routes and forbidden methods", async () => {
    expect(await handler(request("unknown"))).toHaveProperty("status", 405);
    expect(await handler(request("models", { method: "POST" }))).toHaveProperty("status", 405);
  });

  it("accepts Vercel's catch-all route parameter but rejects other queries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonUpstream()));
    expect(await handler(request("models?path=models"))).toHaveProperty("status", 200);
    expect(await handler(request("models?path=models&debug=true"))).toHaveProperty("status", 400);
    expect(await handler(request("models?path=chat"))).toHaveProperty("status", 400);
  });

  it("rejects missing and injection-prone secrets without reflecting them", async () => {
    const missing = await handler(new Request("https://app.example/api/test/models"));
    expect(missing.status).toBe(401);

    const badSecret = "bad\r\nInjected: yes";
    const malformed = {
      url: "https://app.example/api/test/models",
      method: "GET",
      headers: {
        get(name: string) {
          return name.toLowerCase() === "x-test-key" ? badSecret : null;
        },
      },
    } as Request;
    const invalid = await handler(malformed);
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain(badSecret);
  });

  it("requires JSON for POST requests", async () => {
    const response = await handler(request("chat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "prompt",
    }));
    expect(response.status).toBe(415);
  });

  it("rejects invalid and excessive content lengths", async () => {
    const invalid = await handler(request("chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "invalid" },
      body: "{}",
    }));
    expect(invalid.status).toBe(400);

    const excessive = await handler(request("chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "17" },
      body: "{}",
    }));
    expect(excessive.status).toBe(413);
  });

  it("rejects an unexpected upstream content type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("wrong", { headers: { "Content-Type": "text/plain" } }),
    ));
    expect(await handler(request())).toHaveProperty("status", 502);
  });

  it("returns a controlled timeout without leaking key or prompt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    const prompt = "private";
    const response = await handler(request("chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p: prompt }),
    }));
    const text = await response.text();
    expect(response.status).toBe(504);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(prompt);
  });

  it("forwards an allowed request with bounded no-store response headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonUpstream());
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-AIDUSIA-Request-ID")).toBeTruthy();
    expect(await response.text()).not.toContain(SECRET);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
      .toBe(`Bearer ${SECRET}`);
  });

  it("interrupts a response stream that exceeds its limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1234"));
        controller.enqueue(new TextEncoder().encode("5"));
        controller.close();
      },
    });
    const bounded = limitResponseStream(stream, 4);
    await expect(new Response(bounded).text()).rejects.toThrow(/trop volumineuse/i);
  });
});
