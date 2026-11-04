import { afterEach, describe, expect, it } from "vitest";
import { readBenchmarkHistory, saveBenchmarkRun } from "@/lib/localAiBenchmark";

describe("localAiBenchmark storage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("persists runs newest-first with a cap", () => {
    for (let i = 0; i < 45; i++) {
      saveBenchmarkRun({
        id: `run-${i}`,
        catalogEntryId: "browser-llama-3.2-1b",
        providerId: "browser",
        modelId: "m",
        startedAt: i,
        durationMs: 100,
        firstTokenMs: 10,
        outputChars: 2,
        device: {
          mobile: false,
          webgpuSupported: true,
          webgpuDetail: "",
          deviceMemoryGb: 8,
          cpuCores: 4,
        },
        ok: true,
      });
    }
    const history = readBenchmarkHistory();
    expect(history).toHaveLength(40);
    expect(history[0]?.id).toBe("run-44");
  });
});
