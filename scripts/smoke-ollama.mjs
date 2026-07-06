// Smoke test manuel (pas en CI) : verifie que la logique de parsing NDJSON du
// provider Ollama (src/providers/ollama.ts) fonctionne contre un vrai Ollama.
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5:1.5b",
    stream: true,
    messages: [{ role: "user", content: "Reponds en un mot: dis bonjour" }],
  }),
});

if (!response.ok || !response.body) {
  throw new Error(`Ollama a repondu ${response.status}`);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let full = "";

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const json = JSON.parse(line);
    if (json.message?.content) {
      full += json.message.content;
      process.stdout.write(json.message.content);
    }
  }
}

console.log("\n\n--- reponse complete ---");
console.log(full);
console.log(full.length > 0 ? "SMOKE TEST: PASS" : "SMOKE TEST: FAIL (reponse vide)");
