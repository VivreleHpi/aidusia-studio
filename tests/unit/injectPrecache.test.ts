import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function fixtureFile(root: string, relativePath: string, content: string | Uint8Array) {
  const path = join(root, "dist", ...relativePath.split("/"));
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content);
}

function readInjectedPrecache(serviceWorker: string): string[] {
  const match = serviceWorker.match(/^self\.__PRECACHE__ = (.*);$/m);
  if (!match) throw new Error("Manifest de precache absent du service worker genere");
  return JSON.parse(match[1]) as string[];
}

describe("inject-precache", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it("exclut Tesseract et les gros chunks du manifeste produit", async () => {
    const root = await mkdtemp(join(tmpdir(), "aidusia-precache-"));
    temporaryDirectories.push(root);

    await fixtureFile(root, "index.html", "<!doctype html><title>AIDUSIA</title>");
    await fixtureFile(root, "sw.js", "self.addEventListener('fetch', () => {});\n");
    await fixtureFile(root, "assets/app-hash.js", "console.log('shell');\n");
    await fixtureFile(root, "assets/app-hash.css", "body { color: black; }\n");
    await fixtureFile(root, "assets/lib-webllm-hash.js", new Uint8Array(1_500_001));
    await fixtureFile(root, "assets/app-hash.js.map", "{}\n");
    // Les petits fichiers OCR etaient auparavant precaches tandis que le
    // coeur, plus gros, ne l'etait pas : le test couvre les deux tailles.
    await fixtureFile(root, "tesseract/worker.min.js", "self.onmessage = () => {};\n");
    await fixtureFile(root, "tesseract/lang/fra.traineddata.gz", new Uint8Array(128));
    await fixtureFile(
      root,
      "tesseract/tesseract-core-simd-lstm.wasm",
      new Uint8Array(1_500_001),
    );

    await execFileAsync(process.execPath, [resolve("scripts/inject-precache.mjs")], {
      cwd: root,
    });

    const serviceWorker = await readFile(join(root, "dist", "sw.js"), "utf8");
    const precache = readInjectedPrecache(serviceWorker);

    expect(precache).toContain("/");
    expect(precache).toContain("/assets/app-hash.js");
    expect(precache).toContain("/assets/app-hash.css");
    expect(precache).not.toContain("/assets/app-hash.js.map");
    expect(precache.some((url) => url.includes("webllm"))).toBe(false);
    expect(precache.some((url) => url.startsWith("/tesseract/"))).toBe(false);
  });
});
