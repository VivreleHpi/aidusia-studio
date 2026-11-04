import { describe, expect, it } from "vitest";
import { splitUserFacingError } from "@/lib/chatErrorDisplay";

describe("splitUserFacingError", () => {
  it("splits French init errors from technical detail", () => {
    const message =
      "Impossible d'initialiser l'IA locale sur cet appareil (téléchargement interrompu, adaptateur WebGPU refusé ou mémoire insuffisante). Détail : No compatible GPU found.";
    expect(splitUserFacingError(message)).toEqual({
      summary:
        "Impossible d'initialiser l'IA locale sur cet appareil (téléchargement interrompu, adaptateur WebGPU refusé ou mémoire insuffisante).",
      detail: "No compatible GPU found.",
    });
  });

  it("returns the whole string when no marker is present", () => {
    expect(splitUserFacingError("Erreur simple")).toEqual({ summary: "Erreur simple" });
  });
});
