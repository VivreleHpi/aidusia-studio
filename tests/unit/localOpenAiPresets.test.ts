import { describe, expect, it } from "vitest";
import { LOCAL_OPENAI_PRESETS } from "@/lib/localOpenAiPresets";

describe("localOpenAiPresets", () => {
  it("lists localhost presets", () => {
    expect(LOCAL_OPENAI_PRESETS.some((p) => p.id === "lm-studio")).toBe(true);
    expect(LOCAL_OPENAI_PRESETS[0].baseUrl).toMatch(/^http:\/\/127\.0\.0\.1/);
  });
});
