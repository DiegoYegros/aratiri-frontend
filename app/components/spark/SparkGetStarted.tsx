"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

export const SparkGetStarted = ({
  onCreate,
  onRestore,
}: {
  onCreate: () => void;
  onRestore: () => void;
}) => {
  const t = useTranslation();

  return (
    <div className="max-w-md mx-auto text-center py-8">
      <p className="font-semibold mb-1">{t("Keep your keys with Spark")}</p>
      <p className="text-sm text-muted mb-6">
        {t(
          "A self-custody Bitcoin wallet. You hold your keys — Aratiri can't recover them, and can't take them."
        )}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="flex-1 min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
        >
          {t("Create a Spark wallet")}
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="flex-1 min-h-12 text-sm font-semibold py-3 px-4 rounded-lg border border-panel-edge text-muted hover:text-foreground hover:bg-panel-elevated transition touch-manipulation"
        >
          {t("Restore a wallet")}
        </button>
      </div>
    </div>
  );
};
