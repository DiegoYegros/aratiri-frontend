"use client";

import { Lock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** Locked + privacy-on: never a zero, never blurred digits. */
export const SparkHiddenState = ({ onUnlock }: { onUnlock: () => void }) => {
  const t = useTranslation();
  return (
    <section
      className="text-center my-10"
      aria-labelledby="spark-hidden-heading"
    >
      <div className="flex justify-center mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-accent/30 bg-accent-subtle text-accent">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          {t("Privacy on")}
        </span>
      </div>
      <h2 id="spark-hidden-heading" className="text-lg font-semibold mb-2">
        {t("Balance hidden while locked — unlock to view.")}
      </h2>
      <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
        {t(
          "This wallet hides its balance from third parties. Enter your backup phrase to unlock it."
        )}
      </p>
      <button
        type="button"
        onClick={onUnlock}
        className="min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-6 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
      >
        {t("Unlock wallet")}
      </button>
    </section>
  );
};
