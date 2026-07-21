import { beforeEach, describe, expect, it } from "vitest";
import { getApiKey, isPersistEnabled, setApiKey, setPersistEnabled } from "@/lib/apiKeys";

const FLAG = "aidusia_persist_keys";
const KEY = "aidusia_key_openai";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("API key persistence", () => {
  it("uses session-only storage by default on a new installation", () => {
    expect(isPersistEnabled()).toBe(false);

    setApiKey("openai", "session-secret");

    expect(sessionStorage.getItem(KEY)).toBe("session-secret");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("migrates a legacy installation with persisted keys without deleting them", () => {
    localStorage.setItem(KEY, "legacy-secret");

    expect(isPersistEnabled()).toBe(true);
    expect(localStorage.getItem(FLAG)).toBe("true");
    expect(localStorage.getItem(KEY)).toBe("legacy-secret");
    expect(getApiKey("openai")).toBe("legacy-secret");
  });

  it("persists only after explicit opt-in and keeps the session copy on opt-out", () => {
    setApiKey("openai", "persistent-secret");
    expect(localStorage.getItem(KEY)).toBeNull();

    setPersistEnabled(true);
    expect(localStorage.getItem(KEY)).toBe("persistent-secret");

    setPersistEnabled(false);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBe("persistent-secret");
    expect(getApiKey("openai")).toBe("persistent-secret");
  });

  it("moves a legacy local-only key into the current session before opting out", () => {
    localStorage.setItem(KEY, "legacy-secret");

    setPersistEnabled(false);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBe("legacy-secret");
    expect(getApiKey("openai")).toBe("legacy-secret");
  });

  it("does not overwrite a newer session key when disabling persistence", () => {
    localStorage.setItem(KEY, "old-persisted-secret");
    sessionStorage.setItem(KEY, "new-session-secret");

    setPersistEnabled(false);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBe("new-session-secret");
  });
});
