export interface EdgeProxyRoute {
  methods: readonly string[];
  timeoutMs: number;
  maxBodyBytes: number;
  maxResponseBytes: number;
  responseContentTypes: readonly string[];
}

export interface EdgeProxyConfig {
  requestPathPrefix: string;
  upstreamBaseUrl: string;
  secretHeader: string;
  missingSecretMessage: string;
  invalidSecretMessage: string;
  unreachableMessage: string;
  timeoutMessage: string;
  routes: Record<string, EdgeProxyRoute>;
}

const JSON_CONTENT_TYPE = "application/json";

function requestId(): string {
  return crypto.randomUUID();
}

function normalizedContentType(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function errorResponse(error: string, status: number, id: string): Response {
  return new Response(JSON.stringify({ error, requestId: id }), {
    status,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-AIDUSIA-Request-ID": id,
    },
  });
}

function sourceViolation(request: Request): string | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return "Origine interdite";

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return "Contexte de navigation interdit";
  }
  return null;
}

function validSecret(value: string): boolean {
  const containsForbiddenCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint === 0 || codePoint === 10 || codePoint === 13;
  });

  return (
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !containsForbiddenCharacter
  );
}

async function readBodyLimited(
  request: Request,
  maximumBytes: number,
): Promise<ArrayBuffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const declared = request.headers.get("content-length");
  if (declared && !/^\d+$/.test(declared)) throw new Error("INVALID_CONTENT_LENGTH");
  if (declared && Number(declared) > maximumBytes) throw new Error("BODY_TOO_LARGE");

  const body = await request.arrayBuffer();
  if (body.byteLength > maximumBytes) throw new Error("BODY_TOO_LARGE");
  return body;
}

export function limitResponseStream(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let received = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel("Upstream response too large");
        controller.error(new Error("Réponse fournisseur trop volumineuse"));
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export function createEdgeProxyHandler(config: EdgeProxyConfig) {
  return async function handler(request: Request): Promise<Response> {
    const id = requestId();
    const violation = sourceViolation(request);
    if (violation) return errorResponse(violation, 403, id);

    const url = new URL(request.url);
    const path = url.pathname.replace(config.requestPathPrefix, "").replace(/^\/+/, "");
    const queryEntries = [...url.searchParams.entries()];
    const hasOnlyVercelCatchAllParameters = queryEntries.every(
      ([name]) => name === "path",
    );
    if (queryEntries.length > 0 && !hasOnlyVercelCatchAllParameters) {
      return errorResponse("Paramètres de requête interdits", 400, id);
    }

    const route = config.routes[path];
    if (!route || !route.methods.includes(request.method)) {
      return errorResponse("Route ou méthode interdite", 405, id);
    }

    const apiKey = request.headers.get(config.secretHeader);
    if (!apiKey) return errorResponse(config.missingSecretMessage, 401, id);
    if (!validSecret(apiKey)) return errorResponse(config.invalidSecretMessage, 400, id);

    if (request.method === "POST") {
      const contentType = normalizedContentType(request.headers.get("content-type"));
      if (contentType !== JSON_CONTENT_TYPE) {
        return errorResponse("Content-Type non supporté", 415, id);
      }
    }

    let body: ArrayBuffer | undefined;
    try {
      body = await readBodyLimited(request, route.maxBodyBytes);
    } catch (error) {
      if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
        return errorResponse("Corps de requête trop volumineux", 413, id);
      }
      return errorResponse("Content-Length invalide", 400, id);
    }

    let upstream: Response;
    try {
      upstream = await fetch(new URL(path, config.upstreamBaseUrl), {
        method: request.method,
        headers: {
          "Content-Type": JSON_CONTENT_TYPE,
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "AIDUSIA-Studio-Proxy",
        },
        body,
        signal: AbortSignal.timeout(route.timeoutMs),
      });
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === "TimeoutError";
      return errorResponse(
        timeout ? config.timeoutMessage : config.unreachableMessage,
        504,
        id,
      );
    }

    const contentType = normalizedContentType(upstream.headers.get("content-type"));
    if (!route.responseContentTypes.includes(contentType)) {
      await upstream.body?.cancel();
      return errorResponse("Type de réponse fournisseur inattendu", 502, id);
    }

    const responseBody = upstream.body
      ? limitResponseStream(upstream.body, route.maxResponseBytes)
      : null;
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType || JSON_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-AIDUSIA-Request-ID": id,
        Vary: "Origin, Sec-Fetch-Site",
      },
    });
  };
}
