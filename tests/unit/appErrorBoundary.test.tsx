import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

function BrokenComponent(): never {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("aidusia_lang", "fr");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche une récupération sans prétendre que les données ont été supprimées", () => {
    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Vos conversations locales n’ont pas été supprimées",
    );
    expect(screen.getByRole("button", { name: "Recharger l’application" })).toBeVisible();
  });
});
