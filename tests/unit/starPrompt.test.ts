import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissStarPrompt,
  loadStarPromptState,
  recordCompletedResponse,
  shouldShowStarPrompt,
  snoozeStarPrompt,
} from "@/lib/starPrompt";

const KEY = "aidusia_star_prompt_v1";

beforeEach(() => localStorage.clear());

describe("politique d'affichage du rappel étoile GitHub", () => {
  it("reste muet avant 3 réponses réussies, puis propose", () => {
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
    recordCompletedResponse();
    recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
    recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(true);
  });

  it("« Plus tard » reporte de 8 réponses, un second report arrête définitivement", () => {
    for (let i = 0; i < 3; i++) recordCompletedResponse();
    snoozeStarPrompt();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);

    for (let i = 0; i < 7; i++) recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
    recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(true);

    const terminal = snoozeStarPrompt();
    expect(terminal.done).toBe(true);
    for (let i = 0; i < 50; i++) recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
  });

  it("un refus explicite (ou l'étoile donnée) est définitif", () => {
    for (let i = 0; i < 3; i++) recordCompletedResponse();
    dismissStarPrompt();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
    for (let i = 0; i < 50; i++) recordCompletedResponse();
    expect(shouldShowStarPrompt(loadStarPromptState())).toBe(false);
  });

  it("après un état terminal, le compteur cesse d'évoluer", () => {
    dismissStarPrompt();
    const before = loadStarPromptState();
    recordCompletedResponse();
    expect(loadStarPromptState()).toEqual(before);
  });

  it("un stockage corrompu repart de l'état par défaut", () => {
    localStorage.setItem(KEY, "{pas du json");
    expect(loadStarPromptState()).toEqual({ count: 0, next: 3, snoozes: 0, done: false });
    localStorage.setItem(KEY, JSON.stringify({ count: "trois", next: 3, snoozes: 0, done: false }));
    expect(loadStarPromptState()).toEqual({ count: 0, next: 3, snoozes: 0, done: false });
  });
});
