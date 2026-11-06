import { describe, expect, it } from "vitest";
import {
  getLocalAiCatalog,
  getLocalAiCatalogEntry,
  listLocalAiCatalogEntries,
} from "@/lib/localAiCatalog";

describe("local AI catalog", () => {
  it("loads a versioned catalog with unique ids", () => {
    const catalog = getLocalAiCatalog();
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.entries.length).toBeGreaterThanOrEqual(4);
    const ids = listLocalAiCatalogEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes browser, portable and ollama runtimes", () => {
    const runtimes = new Set(listLocalAiCatalogEntries().map((e) => e.runtime));
    expect(runtimes.has("webllm")).toBe(true);
    expect(runtimes.has("wllama")).toBe(true);
    expect(runtimes.has("ollama")).toBe(true);
  });

  it("resolves entries by id", () => {
    expect(getLocalAiCatalogEntry("browser-llama-3.2-1b")?.providerId).toBe("browser");
  });
});
