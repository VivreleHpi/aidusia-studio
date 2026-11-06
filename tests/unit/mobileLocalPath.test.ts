import { describe, expect, it, vi } from "vitest";
import {
  getMobileLocalPathAdvice,
  heavyMobileModelMessage,
  isHeavyMobileBrowserModel,
} from "@/lib/mobileLocalPath";

vi.mock("@/lib/deviceDetect", () => ({
  isMobile: vi.fn(() => true),
}));

vi.mock("@/lib/hardwareGovernor", () => ({
  probeWebGpu: vi.fn(async () => ({ supported: false, adapter: null })),
}));

describe("mobileLocalPath", () => {
  it("flags heavy browser model ids", () => {
    expect(isHeavyMobileBrowserModel("Llama-3.2-3B")).toBe(true);
    expect(isHeavyMobileBrowserModel("Llama-3.2-1B")).toBe(false);
  });

  it("returns the portable model when mobile without WebGPU", async () => {
    const advice = await getMobileLocalPathAdvice("fr");
    expect(advice.mobile).toBe(true);
    expect(advice.recommendation).toBe("portable");
    expect(advice.title).toMatch(/WebGPU/i);
  });

  it("warns on heavy models for mobile", () => {
    expect(heavyMobileModelMessage("en", "Qwen2.5-7B")).toMatch(/heavy/i);
    expect(heavyMobileModelMessage("en", "Qwen2.5-1.5B")).toBeNull();
  });
});
