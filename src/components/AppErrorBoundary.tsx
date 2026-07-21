import { Component, type ErrorInfo, type ReactNode } from "react";

const STRINGS = {
  fr: {
    title: "L’application a rencontré un problème",
    body: "Vos conversations locales n’ont pas été supprimées. Rechargez l’application pour réessayer.",
    reload: "Recharger l’application",
  },
  en: {
    title: "The application encountered a problem",
    body: "Your local conversations have not been deleted. Reload the application to try again.",
    reload: "Reload application",
  },
} as const;

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

function currentLanguage(): keyof typeof STRINGS {
  try {
    const stored = localStorage.getItem("aidusia_lang");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // Le stockage peut être indisponible dans un contexte privé ou restreint.
  }
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Aucune télémétrie : une erreur de rendu ne doit jamais exporter de
    // conversation, de clé ou d’autre donnée locale.
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const s = STRINGS[currentLanguage()];
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-lg"
        >
          <h1 className="text-lg font-semibold">{s.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {s.reload}
          </button>
        </section>
      </main>
    );
  }
}
