import { afterEach, describe, expect, it } from "vitest";
import { getStoredLang } from "@/lib/i18n";

describe("getStoredLang URL override", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("reads ?lang=en and persists the choice", () => {
    window.history.replaceState({}, "", "/?lang=en");
    expect(getStoredLang()).toBe("en");
    expect(localStorage.getItem("aidusia_lang")).toBe("en");
  });
});
