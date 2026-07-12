import { describe, expect, it } from "vitest";
import { importSettings } from "@/lib/settingsTransfer";

function encryptedFile(overrides: Record<string, unknown> = {}) {
  return new File([JSON.stringify({
    v: 1,
    kdf: "PBKDF2",
    iter: 310_000,
    salt: "AAAAAAAAAAAAAAAAAAAAAA==",
    iv: "AAAAAAAAAAAAAAAA",
    data: "AAAA",
    ...overrides,
  })], "settings.aidusia", { type: "application/json" });
}

describe("importSettings envelope validation", () => {
  it.each([99_999, 1_000_001, Number.NaN])("rejects unsafe PBKDF2 iteration count %s", async (iter) => {
    await expect(importSettings(encryptedFile({ iter }), "secret")).rejects.toThrow(/incorrecte|corrompu/);
  });

  it("rejects malformed and unsupported envelopes", async () => {
    await expect(importSettings(new File(["not-json"], "bad.aidusia"), "secret"))
      .rejects.toThrow(/incorrecte|corrompu/);
    await expect(importSettings(encryptedFile({ v: 2 }), "secret"))
      .rejects.toThrow(/incorrecte|corrompu/);
  });
});
