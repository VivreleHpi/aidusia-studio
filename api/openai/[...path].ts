export const config = { runtime: "edge" };

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;
const ROUTES: Record<string, readonly string[]> = {
  models: ["GET"],
  "chat/completions": ["POST"],
};

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Proxy stateless : ne stocke rien, ne journalise rien (ni la cle, ni le
// contenu des messages). Seule raison d'etre : OpenAI bloque le CORS direct
// navigateur (verifie empiriquement, cf. README). La cle transite en header
// X-OpenAI-Key et est immediatement transferee a OpenAI, jamais persistee.
export default async function handler(request: Request): Promise<Response> {
  const apiKey = request.headers.get("X-OpenAI-Key");
  if (!apiKey) {
    return jsonError("Cle OpenAI manquante", 401);
  }
  if (apiKey.length > 512) return jsonError("Cle OpenAI invalide", 400);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/openai\//, "");
  if (!ROUTES[path]?.includes(request.method)) return jsonError("Route ou methode interdite", 405);
  if (
    request.method === "POST" &&
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
  ) {
    return jsonError("Content-Type non supporte", 415);
  }
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_BODY_BYTES) return jsonError("Corps de requete trop volumineux", 413);
  const body = request.method === "GET" ? undefined : await request.text();
  if (body && new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return jsonError("Corps de requete trop volumineux", 413);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.openai.com/v1/${path}`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return jsonError(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Delai OpenAI depasse"
        : "OpenAI injoignable",
      504,
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
