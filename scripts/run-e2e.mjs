import { spawn } from "node:child_process";
import process from "node:process";

const [project = "chromium", ...extraArgs] = process.argv.slice(2);
const viteCli = new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1");
const playwrightCli = new URL("../node_modules/@playwright/test/cli.js", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1");
const baseUrl = "http://127.0.0.1:4173";

const server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "4173"], {
  cwd: process.cwd(),
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for the E2E server");
}

function stopServer() {
  if (server.exitCode === null) server.kill();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServer();
    process.exit(130);
  });
}

try {
  await waitForServer();
  const runner = spawn(
    process.execPath,
    [playwrightCli, "test", `--project=${project}`, ...extraArgs],
    { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, AIDUSIA_E2E_SERVER: baseUrl } },
  );
  const exitCode = await new Promise((resolve) => runner.once("exit", (code) => resolve(code ?? 1)));
  process.exitCode = exitCode;
} finally {
  stopServer();
}
