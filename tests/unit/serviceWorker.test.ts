import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: Record<string, unknown>) => void;

interface Harness {
  handlers: Map<string, Handler>;
  cache: {
    add: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
  fetchMock: ReturnType<typeof vi.fn>;
  skipWaiting: ReturnType<typeof vi.fn>;
}

function loadServiceWorker(): Harness {
  const handlers = new Map<string, Handler>();
  const cache = {
    add: vi.fn(async () => undefined),
    match: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  };
  const fetchMock = vi.fn();
  const skipWaiting = vi.fn();
  const self = {
    __PRECACHE__: [],
    location: { origin: "https://aidusia.test" },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting,
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => undefined),
  };

  const source = readFileSync(resolve("public/sw.js"), "utf8");
  vm.runInNewContext(source, {
    Headers,
    Request,
    Response,
    Set,
    URL,
    caches,
    fetch: fetchMock,
    self,
  });
  return { handlers, cache, fetchMock, skipWaiting };
}

function request(url: string, destination = "") {
  return {
    destination,
    headers: new Headers(),
    method: "GET",
    mode: "cors",
    url,
  };
}

function dispatchFetch(handler: Handler, req: ReturnType<typeof request>) {
  let response: Promise<Response> | undefined;
  const background: Promise<unknown>[] = [];
  const respondWith = vi.fn((value: Promise<Response>) => {
    response = value;
  });
  handler({
    request: req,
    respondWith,
    waitUntil: (value: Promise<unknown>) => background.push(value),
  });
  return { background, respondWith, response: () => response };
}

describe("service worker cache boundary", () => {
  let harness: Harness;
  let fetchHandler: Handler;

  beforeEach(() => {
    harness = loadServiceWorker();
    fetchHandler = harness.handlers.get("fetch")!;
  });

  it("does not intercept same-origin API requests or non-static application routes", () => {
    const api = dispatchFetch(fetchHandler, request("https://aidusia.test/api/openai/models"));
    const route = dispatchFetch(fetchHandler, request("https://aidusia.test/account"));

    expect(api.respondWith).not.toHaveBeenCalled();
    expect(route.respondWith).not.toHaveBeenCalled();
    expect(harness.fetchMock).not.toHaveBeenCalled();
    expect(harness.cache.match).not.toHaveBeenCalled();
  });

  it("filters API and non-static URLs received through cache-assets messages", async () => {
    harness.fetchMock.mockResolvedValueOnce(new Response("asset"));
    const pending: Promise<unknown>[] = [];
    harness.handlers.get("message")!({
      data: {
        type: "cache-assets",
        urls: [
          "https://aidusia.test/api/openai/models.json",
          "https://aidusia.test/account",
          "https://aidusia.test/assets/app.js",
        ],
      },
      waitUntil: (value: Promise<unknown>) => pending.push(value),
    });

    await Promise.all(pending);
    expect(harness.fetchMock).toHaveBeenCalledOnce();
    expect(harness.fetchMock).toHaveBeenCalledWith("https://aidusia.test/assets/app.js");
    expect(harness.cache.put).toHaveBeenCalledOnce();
    expect(harness.cache.put).toHaveBeenCalledWith(
      "https://aidusia.test/assets/app.js",
      expect.any(Response),
    );
  });

  it("never stores a static response marked no-store", async () => {
    harness.fetchMock.mockResolvedValueOnce(
      new Response("private", { headers: { "Cache-Control": "private, no-store" } }),
    );
    const event = dispatchFetch(
      fetchHandler,
      request("https://aidusia.test/assets/app.js", "script"),
    );

    expect(event.respondWith).toHaveBeenCalledOnce();
    await event.response();
    expect(harness.fetchMock).toHaveBeenCalledOnce();
    expect(harness.cache.put).not.toHaveBeenCalled();
  });

  it("caches an eligible static asset for offline use", async () => {
    harness.fetchMock.mockResolvedValueOnce(
      new Response("asset", { headers: { "Cache-Control": "public, max-age=31536000" } }),
    );
    const req = request("https://aidusia.test/assets/app.js", "script");
    const event = dispatchFetch(fetchHandler, req);

    await event.response();
    expect(harness.cache.match).toHaveBeenCalledOnce();
    expect(harness.cache.put).toHaveBeenCalledOnce();
    expect(harness.cache.put).toHaveBeenCalledWith(req, expect.any(Response));
  });

  it("activates a waiting update only after an explicit user message", () => {
    expect(harness.skipWaiting).not.toHaveBeenCalled();
    harness.handlers.get("message")!({ data: { type: "skip-waiting" } });
    expect(harness.skipWaiting).toHaveBeenCalledOnce();
  });
});
