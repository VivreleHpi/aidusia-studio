import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";

const [project = "chromium", ...extraArgs] = process.argv.slice(2);

if (!existsSync("dist/index.html")) {
  throw new Error("Le build dist est absent. Exécutez npm run build avant les E2E.");
}

const viteCli = new URL("../node_modules/vite/bin/vite.js", import.meta.url)
  .pathname.replace(/^\/(.:\/)/, "$1");
const playwrightCli = new URL("../node_modules/@playwright/test/cli.js", import.meta.url)
  .pathname.replace(/^\/(.:\/)/, "$1");
const mockServices = new URL("./e2e-mock-services.mjs", import.meta.url)
  .pathname.replace(/^\/(.:\/)/, "$1");

const baseUrl = "http://127.0.0.1:4173";
const mockUrl = "http://127.0.0.1:4174";

const preview = spawn(
  process.execPath,
  [viteCli, "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { cwd: process.cwd(), stdio: ["ignore", "inherit", "inherit"] },
);
const mocks = spawn(process.execPath, [mockServices], {
  cwd: process.cwd(),
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForUrl(target, child) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Un serveur E2E s’est arrêté avec le code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch {
      // Démarrage en cours.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Délai dépassé pour ${target}`);
}

function stopChild(child) {
  if (child.exitCode === null) child.kill();
}
function stopServers() {
  stopChild(preview);
  stopChild(mocks);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServers();
    process.exit(130);
  });
}

try {
  await Promise.all([
    waitForUrl(baseUrl, preview),
    waitForUrl(`${mockUrl}/__e2e/stats`, mocks),
  ]);
  const runner = spawn(
    process.execPath,
    [playwrightCli, "test", `--project=${project}`, ...extraArgs],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        AIDUSIA_E2E_SERVER: baseUrl,
        AIDUSIA_E2E_MOCK_URL: mockUrl,
      },
    },
  );
  const exitCode = await new Promise((resolve) =>
    runner.once("exit", (code) => resolve(code ?? 1)),
  );
  process.exitCode = exitCode;
} finally {
  stopServers();
}
