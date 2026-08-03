"use client";

import { KeyRound, Landmark } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import type { SparkStatus } from "./SparkProvider";

export type WalletKind = "custodial" | "spark";

export const WalletSwitcher = ({
  active,
  onChange,
  sparkStatus,
  onCreate,
  onRestore,
}: {
  active: WalletKind;
  onChange: (kind: WalletKind) => void;
  sparkStatus: SparkStatus;
  onCreate: () => void;
  onRestore: () => void;
}) => {
  const t = useTranslation();
  const showGetStarted = sparkStatus === "not-created";

  return (
    <div className="mb-6">
      <div
        role="group"
        aria-label={t("Wallet type")}
        className="inline-flex rounded-lg border border-panel-edge bg-panel p-1 gap-1"
      >
        <button
          type="button"
          onClick={() => onChange("custodial")}
          aria-pressed={active === "custodial"}
          className={`inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-md transition-colors touch-manipulation ${
            active === "custodial"
              ? "bg-panel-elevated text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Landmark className="w-4 h-4" aria-hidden="true" />
          {t("Custodial")}
        </button>
        <button
          type="button"
          onClick={() => onChange("spark")}
          aria-pressed={active === "spark"}
          className={`inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-md transition-colors touch-manipulation ${
            active === "spark"
              ? "bg-panel-elevated text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          {t("Self-custody")}
        </button>
      </div>

      {active === "spark" && showGetStarted && (
        <div className="mt-4 border border-panel-edge rounded-lg p-5 bg-panel">
          <p className="font-semibold mb-1">
            {t("Keep your keys with Spark")}
          </p>
          <p className="text-sm text-muted mb-4">
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
      )}
    </div>
  );
};
