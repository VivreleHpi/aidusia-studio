import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { getMobileLocalPathAdvice, type MobileLocalPathAdvice } from "@/lib/mobileLocalPath";
import { IconSparkles } from "@/components/Icons";

interface MobileLocalPathBannerProps {
  providerId: string;
  onOpenProviders: () => void;
}

export function MobileLocalPathBanner({ providerId, onOpenProviders }: MobileLocalPathBannerProps) {
  const { lang } = useLang();
  const [advice, setAdvice] = useState<MobileLocalPathAdvice | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMobileLocalPathAdvice(lang).then((a) => {
      if (!cancelled) setAdvice(a);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (!advice?.mobile) return null;
  if (providerId === "browser" && advice.webgpuSupported) {
    return (
      <div
        role="status"
        className="mx-auto mb-2 max-w-3xl rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
      >
        <p className="font-medium text-foreground">{advice.title}</p>
        <p>{advice.body}</p>
      </div>
    );
  }
  if (providerId === "browser" && !advice.webgpuSupported) {
    return (
      <div
        role="alert"
        className="mx-auto mb-2 max-w-3xl rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
      >
        <p className="font-medium text-foreground">{advice.title}</p>
        <p className="text-muted-foreground">{advice.body}</p>
        <button
          type="button"
          onClick={onOpenProviders}
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-primary-foreground"
        >
          <IconSparkles className="h-3.5 w-3.5" />
          {lang === "fr" ? "Ouvrir Fournisseurs" : "Open Providers"}
        </button>
      </div>
    );
  }
  return null;
}
