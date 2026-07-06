export const config = { runtime: "edge" };

// Proxy stateless : ne stocke rien, ne journalise rien (ni la cle, ni le
// contenu des messages). Seule raison d'etre : OpenAI bloque le CORS direct
// navigateur (verifie empiriquement, cf. README). La cle transite en header
// X-OpenAI-Key et est immediatement transferee a OpenAI, jamais persistee.
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = request.headers.get("X-OpenAI-Key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Cle OpenAI manquante" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
