import http from "node:http";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = 4174;
const APP_ORIGIN = "http://127.0.0.1:4173";

function initialStats() {
  return {
    ollama: { version: 0, tags: 0, show: 0, ps: 0, chat: 0, aborted: 0 },
    mcp: { initialize: 0, listTools: 0, callTool: 0 },
  };
}

let stats = initialStats();

function setCors(request, response) {
  if (request.headers.origin === APP_ORIGIN) {
    response.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Max-Age", "600");
  response.setHeader("Vary", "Origin");
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function messageText(message) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content.map((item) =>
      typeof item?.text === "string" ? item.text : "").join(" ");
  }
  return "";
}

function writeNdjson(response, value) {
  response.write(`${JSON.stringify(value)}\n`);
}

function beginNdjson(response) {
  response.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-store",
  });
}

function sendNormalOllamaResponse(response) {
  beginNdjson(response);
  writeNdjson(response, {
    model: "aidusia-e2e:latest",
    message: { role: "assistant", content: "Réponse locale simulée " },
    done: false,
  });
  setTimeout(() => writeNdjson(response, {
    model: "aidusia-e2e:latest",
    message: { role: "assistant", content: "par Ollama." },
    done: false,
  }), 80);
  setTimeout(() => {
    writeNdjson(response, {
      model: "aidusia-e2e:latest",
      message: { role: "assistant", content: "" },
      done: true,
      done_reason: "stop",
      eval_count: 8,
      eval_duration: 100_000_000,
    });
    response.end();
  }, 160);
}

function sendSlowOllamaResponse(request, response) {
  beginNdjson(response);
  let index = 0;
  let completed = false;
  const timer = setInterval(() => {
    index += 1;
    writeNdjson(response, {
      model: "aidusia-e2e:latest",
      message: { role: "assistant", content: `fragment-${index} ` },
      done: false,
    });
    if (index >= 40) {
      completed = true;
      clearInterval(timer);
      writeNdjson(response, {
        model: "aidusia-e2e:latest",
        message: { role: "assistant", content: "" },
        done: true,
      });
      response.end();
    }
  }, 120);
  response.once("close", () => {
    clearInterval(timer);
    if (!completed) stats.ollama.aborted += 1;
  });
}

function sendToolCall(response, toolName) {
  beginNdjson(response);
  writeNdjson(response, {
    model: "aidusia-e2e:latest",
    message: {
      role: "assistant",
      content: "",
      tool_calls: [{
        function: { name: toolName, arguments: { noteId: "42" } },
      }],
    },
    done: true,
    done_reason: "stop",
  });
  response.end();
}

function sendToolFollowUp(response, refused) {
  beginNdjson(response);
  writeNdjson(response, {
    model: "aidusia-e2e:latest",
    message: {
      role: "assistant",
      content: refused
        ? "L’appel MCP a été refusé. Aucun résultat externe n’a été reçu."
        : "Le résultat MCP a été reçu.",
    },
    done: true,
  });
  response.end();
}

async function handleOllamaChat(request, response) {
  stats.ollama.chat += 1;
  const body = await readJson(request);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.at(-1)?.role === "tool") {
    sendToolFollowUp(
      response,
      messageText(messages.at(-1)).includes("Aucun appel MCP n'a été envoyé"),
    );
    return;
  }
  const prompt = messageText(
    messages.filter((message) => message?.role === "user").at(-1),
  );
  if (prompt.includes("E2E_SLOW")) {
    sendSlowOllamaResponse(request, response);
  } else if (prompt.includes("E2E_TOOL")) {
    const toolName = body.tools?.[0]?.function?.name ?? "read_e2e_note";
    sendToolCall(response, toolName);
  } else {
    sendNormalOllamaResponse(response);
  }
}

async function handleMcp(request, response) {
  const body = await readJson(request);
  if (body.method === "notifications/initialized") {
    response.writeHead(202, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (body.method === "initialize") {
    stats.mcp.initialize += 1;
    sendJson(response, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "Aidusia E2E MCP", version: "1.0.0" },
      },
    });
    return;
  }
  if (body.method === "tools/list") {
    stats.mcp.listTools += 1;
    sendJson(response, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: { tools: [{
        name: "read_e2e_note",
        description: "Returns a deterministic E2E note.",
        inputSchema: {
          type: "object",
          properties: { noteId: { type: "string" } },
          required: ["noteId"],
          additionalProperties: false,
        },
      }] },
    });
    return;
  }
  if (body.method === "tools/call") {
    stats.mcp.callTool += 1;
    sendJson(response, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: "Contenu de la note E2E 42." }],
        isError: false,
      },
    });
    return;
  }
  sendJson(response, 404, {
    jsonrpc: "2.0",
    id: body.id ?? null,
    error: { code: -32601, message: "Méthode MCP inconnue." },
  });
}

const server = http.createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (request.method === "GET" && url.pathname === "/__e2e/stats") {
      sendJson(response, 200, stats);
    } else if (request.method === "POST" && url.pathname === "/__e2e/reset") {
      stats = initialStats();
      sendJson(response, 200, { ok: true });
    } else if (request.method === "GET" && url.pathname === "/api/version") {
      stats.ollama.version += 1;
      sendJson(response, 200, { version: "0.0.0-e2e" });
    } else if (request.method === "GET" && url.pathname === "/api/tags") {
      stats.ollama.tags += 1;
      sendJson(response, 200, { models: [{ name: "aidusia-e2e:latest" }] });
    } else if (request.method === "POST" && url.pathname === "/api/show") {
      stats.ollama.show += 1;
      sendJson(response, 200, { capabilities: ["completion", "tools"] });
    } else if (request.method === "GET" && url.pathname === "/api/ps") {
      stats.ollama.ps += 1;
      sendJson(response, 200, { models: [] });
    } else if (request.method === "POST" && url.pathname === "/api/chat") {
      await handleOllamaChat(request, response);
    } else if (request.method === "POST" && url.pathname === "/mcp") {
      await handleMcp(request, response);
    } else {
      sendJson(response, 404, { error: "Not found" });
    }
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Aidusia E2E mock services: http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
