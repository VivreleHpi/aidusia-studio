import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVisionCapability } from "@/hooks/useVisionCapability";

const { getProvider, listModels } = vi.hoisted(() => ({
  getProvider: vi.fn(),
  listModels: vi.fn(async () => []),
}));

vi.mock("@/providers", () => ({ getProvider }));
vi.mock("@/lib/apiKeys", () => ({ getApiKey: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useVisionCapability", () => {
  it("does not list models again for the text-only browser provider", () => {
    getProvider.mockReturnValue({ listModels });

    const { result } = renderHook(() =>
      useVisionCapability("browser", "Llama-3.2-1B-Instruct-q4f16_1-MLC"),
    );

    expect(result.current).toBe(false);
    expect(getProvider).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
  });
});
