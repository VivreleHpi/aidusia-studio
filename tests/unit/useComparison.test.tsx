import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldRunSequentially,
  useComparison,
  type ComparisonResult,
  type ComparisonTarget,
} from "@/hooks/useComparison";
import type { ChatProvider, StreamChunk } from "@/providers/types";

const providerRegistry = vi.hoisted(() => new Map<string, ChatProvider>());
const getApiKey = vi.hoisted(() => vi.fn((providerId: string) => `key-${providerId}`));

vi.mock("@/providers", () => ({
  getProvider: (providerId: string) => providerRegistry.get(providerId),
}));
vi.mock("@/lib/apiKeys", () => ({ getApiKey }));

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockProvider(id: string, label: string, stream: ChatProvider["chatStream"]): ChatProvider {
  return {
    id,
    label,
    requiresApiKey: true,
    listModels: vi.fn().mockResolvedValue([]),
    testKey: vi.fn().mockResolvedValue({ ok: true }),
    chatStream: vi.fn(stream),
  };
}

const targets: ComparisonTarget[] = [
  { providerId: "alpha", model: "alpha-model" },
  { providerId: "beta", model: "beta-model" },
];

describe("useComparison", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    providerRegistry.clear();
    getApiKey.mockClear();
  });

  it("lance les deux fournisseurs en parallèle et streame des snapshots indépendants", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const alphaDone = deferred();
    const betaDone = deferred();
    let emitAlpha!: (chunk: StreamChunk) => void;
    let emitBeta!: (chunk: StreamChunk) => void;

    const alpha = mockProvider("alpha", "Alpha", async (params, apiKey, onChunk) => {
      expect(params).toMatchObject({
        model: "alpha-model",
        messages: [{ role: "user", content: "Compare-moi" }],
      });
      expect(params.systemPrompt).toContain("Aidusia Studio");
      expect(apiKey).toBe("key-alpha");
      emitAlpha = onChunk;
      await alphaDone.promise;
    });
    const beta = mockProvider("beta", "Beta", async (_params, apiKey, onChunk) => {
      expect(apiKey).toBe("key-beta");
      emitBeta = onChunk;
      await betaDone.promise;
    });
    providerRegistry.set("alpha", alpha);
    providerRegistry.set("beta", beta);

    const snapshots: ComparisonResult[][] = [];
    const { result } = renderHook(() => {
      const comparison = useComparison("fr");
      snapshots.push(comparison.results);
      return comparison;
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Compare-moi", targets);
    });

    // Aucun fournisseur n'a encore terminé, mais les deux ont déjà démarré.
    expect(alpha.chatStream).toHaveBeenCalledTimes(1);
    expect(beta.chatStream).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(true);

    now.mockReturnValue(1_300);
    act(() => emitAlpha({ type: "text", delta: "Réponse " }));
    const alphaSnapshot = result.current.results;
    expect(alphaSnapshot.map((item) => item.content)).toEqual(["Réponse ", ""]);
    expect(alphaSnapshot[0].firstTextMs).toBe(300);

    now.mockReturnValue(1_500);
    act(() => emitBeta({ type: "text", delta: "Autre" }));
    expect(result.current.results.map((item) => item.content)).toEqual(["Réponse ", "Autre"]);
    expect(result.current.results[1].firstTextMs).toBe(500);

    now.mockReturnValue(1_700);
    act(() => emitAlpha({ type: "text", delta: "Alpha" }));
    expect(result.current.results.map((item) => item.content)).toEqual([
      "Réponse Alpha",
      "Autre",
    ]);
    expect(alphaSnapshot[0].content).toBe("Réponse ");
    expect(result.current.results[0].firstTextMs).toBe(300);
    expect(new Set(snapshots).size).toBe(snapshots.length);

    alphaDone.resolve();
    betaDone.resolve();
    await act(async () => pending);

    expect(result.current.results.map((item) => item.status)).toEqual(["done", "done"]);
    expect(result.current.running).toBe(false);
  });

  it("isole l'erreur d'un fournisseur sans interrompre l'autre", async () => {
    const alphaDone = deferred();
    const betaDone = deferred();
    let emitBeta!: (chunk: StreamChunk) => void;

    const alpha = mockProvider("alpha", "Alpha API", async () => {
      await alphaDone.promise;
    });
    const beta = mockProvider("beta", "Beta", async (_params, _apiKey, onChunk) => {
      emitBeta = onChunk;
      await betaDone.promise;
    });
    providerRegistry.set("alpha", alpha);
    providerRegistry.set("beta", beta);

    const { result } = renderHook(() => useComparison("fr"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Question", targets);
    });

    await act(async () => {
      alphaDone.reject(new TypeError("Failed to fetch"));
      await Promise.resolve();
    });

    expect(result.current.results[0]).toMatchObject({ status: "error" });
    expect(result.current.results[0].error).toContain("Alpha API injoignable");
    expect(result.current.results[1].status).toBe("streaming");
    expect(result.current.running).toBe(true);

    act(() => emitBeta({ type: "text", delta: "Réponse disponible" }));
    betaDone.resolve();
    await act(async () => pending);

    expect(result.current.results[0].status).toBe("error");
    expect(result.current.results[1]).toMatchObject({
      status: "done",
      content: "Réponse disponible",
    });
    expect(result.current.running).toBe(false);
  });

  it("arrête les deux streams et conserve leur contenu partiel", async () => {
    const signals: AbortSignal[] = [];
    const emitters: Array<(chunk: StreamChunk) => void> = [];
    const waitForAbort: ChatProvider["chatStream"] = (params, _apiKey, onChunk) => {
      signals.push(params.signal!);
      emitters.push(onChunk);
      return new Promise<void>((_resolve, reject) => {
        params.signal!.addEventListener("abort", () => {
          reject(new DOMException("Arrêté", "AbortError"));
        });
      });
    };

    providerRegistry.set("alpha", mockProvider("alpha", "Alpha", waitForAbort));
    providerRegistry.set("beta", mockProvider("beta", "Beta", waitForAbort));

    const { result } = renderHook(() => useComparison("fr"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Question", targets);
    });
    act(() => {
      emitters[0]({ type: "text", delta: "Début A" });
      emitters[1]({ type: "text", delta: "Début B" });
    });

    act(() => result.current.stop());

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(result.current.running).toBe(false);
    expect(result.current.results).toMatchObject([
      { status: "done", content: "Début A" },
      { status: "done", content: "Début B" },
    ]);
    expect(result.current.results.every((item) => item.error === undefined)).toBe(true);

    await act(async () => pending);
  });

  it("annule le comparatif actif au démontage", async () => {
    const signals: AbortSignal[] = [];
    const waitForAbort: ChatProvider["chatStream"] = (params) => {
      const signal = params.signal!;
      signals.push(signal);
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject({ name: "AbortError" }));
      });
    };

    providerRegistry.set("alpha", mockProvider("alpha", "Alpha", waitForAbort));
    providerRegistry.set("beta", mockProvider("beta", "Beta", waitForAbort));

    const { result, unmount } = renderHook(() => useComparison("fr"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Question", targets);
    });

    unmount();
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await pending;
  });

  it("en séquentiel, ne démarre B qu'après A et mesure chacun depuis son propre départ", async () => {
    let clock = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const alphaDone = deferred();
    const betaStarted = vi.fn();

    providerRegistry.set("alpha", mockProvider("alpha", "Alpha", async (_params, _key, onChunk) => {
      clock = 1_200;
      onChunk({ type: "text", delta: "Réponse A" });
      await alphaDone.promise;
      clock = 5_000;
    }));
    providerRegistry.set("beta", mockProvider("beta", "Beta", async (_params, _key, onChunk) => {
      betaStarted();
      clock = 5_300;
      onChunk({ type: "text", delta: "Réponse B" });
      onChunk({ type: "usage", outputTokens: 40, tokensPerSecond: 20 });
      clock = 7_000;
    }));

    const { result } = renderHook(() => useComparison("fr"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Question", targets, { sequential: true });
    });

    expect(result.current.results[1].status).toBe("queued");
    await act(async () => {});
    expect(betaStarted).not.toHaveBeenCalled();

    await act(async () => {
      alphaDone.resolve();
      await pending;
    });

    expect(betaStarted).toHaveBeenCalledTimes(1);
    expect(result.current.results[0]).toMatchObject({ status: "done", firstTextMs: 200, durationMs: 4_000 });
    expect(result.current.results[1]).toMatchObject({
      status: "done",
      firstTextMs: 300,
      durationMs: 2_000,
      outputTokens: 40,
      tokensPerSecond: 20,
    });
  });

  it("arrêter un comparatif séquentiel ne lance pas le modèle en attente", async () => {
    const betaStarted = vi.fn();
    providerRegistry.set("alpha", mockProvider("alpha", "Alpha", (params) => new Promise<void>((_resolve, reject) => {
      params.signal!.addEventListener("abort", () => reject({ name: "AbortError" }));
    })));
    providerRegistry.set("beta", mockProvider("beta", "Beta", async () => { betaStarted(); }));

    const { result } = renderHook(() => useComparison("fr"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.compare("Question", targets, { sequential: true });
    });
    act(() => result.current.stop());
    await act(async () => pending);

    expect(betaStarted).not.toHaveBeenCalled();
    expect(result.current.results[1]).toMatchObject({ status: "done", interrupted: true, content: "" });
  });

  it("enchaîne les modèles quand les deux tournent sur l'appareil ou en benchmark", () => {
    const local = [{ providerId: "browser", model: "a" }, { providerId: "luciole", model: "b" }];
    const mixed = [{ providerId: "browser", model: "a" }, { providerId: "anthropic", model: "b" }];
    expect(shouldRunSequentially(local, false)).toBe(true);
    expect(shouldRunSequentially(mixed, false)).toBe(false);
    expect(shouldRunSequentially(mixed, true)).toBe(true);
  });
});
