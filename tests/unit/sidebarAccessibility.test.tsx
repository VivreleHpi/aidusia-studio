import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, SIDEBAR_ID } from "@/components/Sidebar";
import type { Conversation } from "@/lib/db";

const conversation: Conversation = {
  id: "conversation-active",
  title: "Conversation active",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
};

let mobileViewport = false;

vi.mock("@/lib/i18n", () => ({
  useLang: () => ({ lang: "fr", setLang: vi.fn() }),
}));
vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));
vi.mock("@/lib/deviceDetect", () => ({ shortcutLabel: (key: string) => `Ctrl+${key}` }));
vi.mock("@/components/PwaStatus", () => ({ PwaStatus: () => null }));

function sidebarProps() {
  return {
    conversations: [conversation],
    currentId: conversation.id,
    activeView: "chat" as const,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onOpenCompare: vi.fn(),
    onDelete: vi.fn(),
    onOpenAbout: vi.fn(),
    onOpenFaq: vi.fn(),
    onOpenGuide: vi.fn(),
    onStartTour: vi.fn(),
    onOpenProviders: vi.fn(),
    onOpenMcp: vi.fn(),
    onOpenData: vi.fn(),
    onPurgeAll: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
  };
}

function MobileSidebarHarness() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        aria-label="Basculer le menu"
        aria-expanded={open ? "true" : "false"}
        aria-controls={SIDEBAR_ID}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <Sidebar {...sidebarProps()} open={open} onClose={close} />
    </>
  );
}

describe("Sidebar — accessibilité de navigation", () => {
  beforeEach(() => {
    mobileViewport = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: mobileViewport && query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("garde la sidebar desktop interactive et identifie la conversation active", () => {
    render(<Sidebar {...sidebarProps()} open={false} onClose={vi.fn()} />);

    const sidebar = document.getElementById(SIDEBAR_ID);
    expect(sidebar).not.toHaveAttribute("inert");
    expect(sidebar).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button", { name: "Conversation active" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("retire le tiroir mobile fermé du focus puis piège le focus lorsqu'il est ouvert", async () => {
    mobileViewport = true;
    render(<MobileSidebarHarness />);

    const toggle = screen.getByRole("button", { name: "Basculer le menu" });
    const sidebar = document.getElementById(SIDEBAR_ID)!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", SIDEBAR_ID);
    expect(sidebar).toHaveAttribute("inert");
    expect(sidebar).toHaveAttribute("aria-hidden", "true");

    toggle.focus();
    fireEvent.click(toggle);
    const close = await screen.findByRole("button", { name: "Fermer le menu" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).not.toHaveAttribute("inert");
    expect(sidebar).not.toHaveAttribute("aria-hidden");

    fireEvent.keyDown(sidebar, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: "Confidentialité" })).toHaveFocus();
    fireEvent.keyDown(sidebar, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(sidebar, { key: "Escape" });
    await waitFor(() => expect(toggle).toHaveFocus());
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("inert");
  });

  it("place le focus dans Paramètres puis le restitue au déclencheur avec Échap", async () => {
    render(<Sidebar {...sidebarProps()} open={false} onClose={vi.fn()} />);

    const settings = screen.getByRole("button", { name: "Paramètres" });
    expect(settings).toHaveAttribute("aria-controls", "aidusia-sidebar-settings");
    fireEvent.click(settings);

    const firstItem = screen.getByRole("button", { name: "Présentation" });
    await waitFor(() => expect(firstItem).toHaveFocus());
    expect(settings).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(settings).toHaveFocus());
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Présentation" })).not.toBeInTheDocument();
  });
});
