import { beforeEach, describe, expect, it, vi } from "vitest";

describe("PWA status", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("publie les changements en ligne et hors ligne", async () => {
    const offline = await import("@/lib/offline");
    const listener = vi.fn();
    const unsubscribe = offline.subscribePwaStatus(listener);

    window.dispatchEvent(new Event("offline"));
    expect(offline.getPwaStatus().online).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(offline.getPwaStatus().online).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("ne declenche le prompt d'installation qu'apres une action explicite", async () => {
    const offline = await import("@/lib/offline");
    offline.subscribePwaStatus(() => {});
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: ReturnType<typeof vi.fn>;
      userChoice: Promise<{ outcome: "accepted" }>;
    };
    event.prompt = vi.fn(async () => {});
    event.userChoice = Promise.resolve({ outcome: "accepted" });

    window.dispatchEvent(event);
    expect(offline.getPwaStatus().installAvailable).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
    await expect(offline.promptPwaInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(offline.getPwaStatus().installAvailable).toBe(false);
  });
});
