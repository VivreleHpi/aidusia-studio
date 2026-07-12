export const config = { runtime: "edge" };

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;
const ROUTES: Record<string, readonly string[]> = { tags: ["GET"], chat: ["POST"] };

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Proxy stateless vers ollama.com (Ollama Cloud) : meme raison qu'OpenAI,
// ollama.com ne renvoie aucun header Access-Control-Allow-Origin sur ses
// vraies reponses (verifie empiriquement) - un navigateur ne peut donc pas
// l'appeler en direct. Ne stocke rien, ne journalise rien.
export default async function handler(request: Request): Promise<Response> {
  const apiKey = request.headers.get("X-Ollama-Key");
  if (!apiKey) {
    return jsonError("Cle Ollama Cloud manquante", 401);
  }
  if (apiKey.length > 512) return jsonError("Cle Ollama Cloud invalide", 400);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ollama-cloud\//, "");
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
    upstream = await fetch(`https://ollama.com/api/${path}`, {
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
        ? "Delai Ollama Cloud depasse"
        : "Ollama Cloud injoignable",
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
