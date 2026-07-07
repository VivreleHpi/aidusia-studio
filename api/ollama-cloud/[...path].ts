export const config = { runtime: "edge" };

// Proxy stateless vers ollama.com (Ollama Cloud) : meme raison qu'OpenAI,
// ollama.com ne renvoie aucun header Access-Control-Allow-Origin sur ses
// vraies reponses (verifie empiriquement) - un navigateur ne peut donc pas
// l'appeler en direct. Ne stocke rien, ne journalise rien.
export default async function handler(request: Request): Promise<Response> {
  const apiKey = request.headers.get("X-Ollama-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Cle Ollama Cloud manquante" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ollama-cloud\//, "");

  const upstream = await fetch(`https://ollama.com/api/${path}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: request.method === "GET" ? undefined : await request.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
