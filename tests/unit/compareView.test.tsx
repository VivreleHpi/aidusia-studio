import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompareView } from "@/components/CompareView";

const providerMocks = vi.hoisted(() => [
  {
    id: "ollama",
    label: "Ollama",
    requiresApiKey: false,
    listModels: vi.fn(async () => [{ id: "ollama-model", label: "Ollama Model" }]),
  },
  {
    id: "browser",
    label: "Browser",
    requiresApiKey: false,
    listModels: vi.fn(async () => [{ id: "browser-model", label: "Browser Model" }]),
  },
]);

const comparison = vi.hoisted(() => ({
  results: [] as Array<Record<string, unknown>>,
  running: false,
  compare: vi.fn(async () => {}),
  stop: vi.fn(),
  reset: vi.fn(),
}));

const synthesis = vi.hoisted(() => ({
  result: null as Record<string, unknown> | null,
  running: false,
  synthesize: vi.fn(async () => {}),
  stop: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/providers", () => ({ listProviders: () => providerMocks }));
vi.mock("@/hooks/useComparison", () => ({ useComparison: () => comparison }));
vi.mock("@/hooks/useComparisonSynthesis", () => ({
  useComparisonSynthesis: () => synthesis,
}));

function renderCompare(onUseResult = vi.fn(async () => {})) {
  const props = {
    onOpenProviders: vi.fn(),
    keysVersion: 0,
    onBackToChat: vi.fn(),
    onUseResult,
  };
  return { ...render(<CompareView {...props} />), props };
}

async function submitQuestion(question: string) {
  fireEvent.change(screen.getByLabelText("Question à comparer"), {
    target: { value: question },
  });
  const compareButton = screen.getByRole("button", { name: "Comparer" });
  await waitFor(() => expect(compareButton).toBeEnabled());
  fireEvent.click(compareButton);
}

function addSuccessfulResults() {
  comparison.results.push(
    {
      target: { providerId: "ollama", model: "ollama-model" },
      status: "done",
      content: "Réponse du modèle A",
      durationMs: 1_000,
    },
    {
      target: { providerId: "browser", model: "browser-model" },
      status: "done",
      content: "Réponse du modèle B",
      durationMs: 2_000,
    },
  );
}

describe("CompareView", () => {
  afterEach(cleanup);

  beforeEach(() => {
    comparison.results.splice(0);
    comparison.running = false;
    comparison.compare.mockClear();
    comparison.stop.mockClear();
    comparison.reset.mockClear();
    synthesis.result = null;
    synthesis.running = false;
    synthesis.synthesize.mockClear();
    synthesis.stop.mockClear();
    synthesis.reset.mockClear();
    providerMocks.forEach((provider) => provider.listModels.mockClear());
  });

  it("attend deux modèles prêts puis lance le même prompt en parallèle", async () => {
    renderCompare();

    const compareButton = screen.getByRole("button", { name: "Comparer" });
    expect(compareButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Question à comparer"), {
      target: { value: "Explique la photosynthèse" },
    });

    await waitFor(() => expect(compareButton).toBeEnabled());
    fireEvent.click(compareButton);

    expect(comparison.compare).toHaveBeenCalledWith("Explique la photosynthèse", [
      { providerId: "ollama", model: "ollama-model" },
      { providerId: "browser", model: "browser-model" },
    ]);
  });

  it("rend le Markdown sans HTML brut ni chargement d'image distante", () => {
    comparison.results.push(
      {
        target: { providerId: "ollama", model: "ollama-model" },
        status: "done",
        content: "**Réponse sûre**\n\n<script>alert('xss')</script>\n\n![pixel](https://tracker.invalid/pixel.png)",
        durationMs: 1_200,
      },
      {
        target: { providerId: "browser", model: "browser-model" },
        status: "error",
        content: "",
        error: "Échec simulé",
        durationMs: 50,
      },
    );

    const { container } = renderCompare();

    expect(screen.getByText("Réponse sûre").tagName).toBe("STRONG");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("[pixel]")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Échec simulé");
    expect(screen.getByText("Répondu en 1,2 s")).toBeInTheDocument();
  });

  it("affiche l'avertissement et explique précisément les données envoyées à la synthèse", () => {
    renderCompare();

    expect(
      screen.getByText("Les IA peuvent faire des erreurs. Vérifiez les informations importantes."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/La synthèse envoie la question et les deux réponses au modèle choisi/),
    ).toHaveTextContent("rien n’est sauvegardé automatiquement");
  });

  it("synthétise les deux réponses avec le modèle A puis permet d'utiliser la synthèse", async () => {
    const onUseResult = vi.fn(async () => {});
    const view = renderCompare(onUseResult);
    await submitQuestion("Quelle réponse retenir ?");
    addSuccessfulResults();
    view.rerender(<CompareView {...view.props} />);

    fireEvent.click(screen.getByRole("button", { name: "Synthétiser avec A" }));
    expect(synthesis.synthesize).toHaveBeenCalledWith(
      "Quelle réponse retenir ?",
      comparison.results,
      { providerId: "ollama", model: "ollama-model" },
    );

    synthesis.result = {
      target: { providerId: "ollama", model: "ollama-model" },
      status: "done",
      content: "Synthèse commune",
      durationMs: 500,
    };
    view.rerender(<CompareView {...view.props} />);

    const synthesisCard = screen.getByRole("heading", { name: "Synthèse" }).closest("article");
    expect(synthesisCard).not.toBeNull();
    expect(within(synthesisCard!).getByText("Synthèse commune")).toBeInTheDocument();
    fireEvent.click(
      within(synthesisCard!).getByRole("button", { name: "Continuer dans le chat" }),
    );

    await waitFor(() =>
      expect(onUseResult).toHaveBeenCalledWith("Quelle réponse retenir ?", synthesis.result),
    );
  });

  it("empêche une double création de conversation et rend l'échec récupérable", async () => {
    let rejectSave: (reason?: unknown) => void = () => {};
    const onUseResult = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    const view = renderCompare(onUseResult);
    await submitQuestion("Continue cette réponse");
    addSuccessfulResults();
    view.rerender(<CompareView {...view.props} />);

    const continueButtons = screen.getAllByRole("button", { name: "Continuer dans le chat" });
    fireEvent.click(continueButtons[0]);
    fireEvent.click(continueButtons[0]);

    expect(onUseResult).toHaveBeenCalledTimes(1);
    expect(onUseResult).toHaveBeenCalledWith("Continue cette réponse", comparison.results[0]);
    expect(continueButtons[0]).toBeDisabled();

    rejectSave(new Error("IndexedDB indisponible"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossible de continuer dans le chat. Réessayez.",
    );
    await waitFor(() => expect(continueButtons[0]).toBeEnabled());
  });

  it("intervertit les modèles A et B avant une nouvelle comparaison", async () => {
    renderCompare();
    fireEvent.change(screen.getByLabelText("Question à comparer"), {
      target: { value: "Compare dans l'autre sens" },
    });
    const compareButton = screen.getByRole("button", { name: "Comparer" });
    await waitFor(() => expect(compareButton).toBeEnabled());
    comparison.reset.mockClear();
    synthesis.reset.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Intervertir A et B" }));
    expect(comparison.reset).toHaveBeenCalledTimes(1);
    expect(synthesis.reset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(compareButton).toBeEnabled());
    fireEvent.click(compareButton);

    expect(comparison.compare).toHaveBeenCalledWith("Compare dans l'autre sens", [
      { providerId: "browser", model: "browser-model" },
      { providerId: "ollama", model: "ollama-model" },
    ]);
  });

  it("exporte localement la question, les réponses et la synthèse en Markdown", async () => {
    const view = renderCompare();
    await submitQuestion("Question exportée");
    addSuccessfulResults();
    view.rerender(<CompareView {...view.props} />);
    fireEvent.click(screen.getByRole("button", { name: "Synthétiser avec B" }));

    synthesis.result = {
      target: { providerId: "browser", model: "browser-model" },
      status: "done",
      content: "Synthèse à exporter",
      durationMs: 300,
    };
    view.rerender(<CompareView {...view.props} />);

    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const createObjectURL = vi.fn(() => "blob:aidusia-comparison");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      fireEvent.click(screen.getByRole("button", { name: "Exporter en Markdown" }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:aidusia-comparison");
      const blob = createObjectURL.mock.calls[0][0];
      const markdown = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.addEventListener("error", () => reject(reader.error));
        reader.readAsText(blob);
      });
      expect(markdown).toContain("Question exportée");
      expect(markdown).toContain("Réponse du modèle A");
      expect(markdown).toContain("Réponse du modèle B");
      expect(markdown).toContain("Synthèse à exporter");
    } finally {
      clickSpy.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});
