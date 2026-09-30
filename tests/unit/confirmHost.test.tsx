import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmHost } from "@/components/ConfirmHost";
import { requestConfirm, type ConfirmRequest } from "@/lib/confirm";

const base: ConfirmRequest = {
  title: "Supprimer ?",
  message: "Action irréversible.",
  confirmLabel: "Supprimer",
  cancelLabel: "Annuler",
};

describe("ConfirmHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche titre, message et détails avec les bons rôles ARIA", async () => {
    render(<ConfirmHost />);
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm({ ...base, details: '{"a": 1}', tone: "danger" });
    });
    const dialog = screen.getByRole("alertdialog", { name: "Supprimer ?" });
    expect(dialog).toHaveAccessibleDescription("Action irréversible.");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText('{"a": 1}')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await expect(promise).resolves.toBe(false);
  });

  it("résout true sur Confirmer", async () => {
    render(<ConfirmHost />);
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm(base);
    });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await expect(promise).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("résout false sur Escape", async () => {
    render(<ConfirmHost />);
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirm(base);
    });
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await expect(promise).resolves.toBe(false);
  });

  it("traite une file de deux demandes dans l'ordre", async () => {
    render(<ConfirmHost />);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = requestConfirm({ ...base, title: "Première" });
      second = requestConfirm({ ...base, title: "Seconde" });
    });
    expect(screen.getByRole("alertdialog", { name: "Première" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await expect(first).resolves.toBe(true);
    expect(screen.getByRole("alertdialog", { name: "Seconde" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await expect(second).resolves.toBe(false);
  });

  it("se désinscrit au démontage et retombe sur window.confirm", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = render(<ConfirmHost />);
    unmount();
    await expect(requestConfirm({ ...base, details: "d" })).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith("Supprimer ?\n\nAction irréversible.\n\nd");
  });
});
