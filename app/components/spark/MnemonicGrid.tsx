"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const MnemonicGrid = ({ mnemonic }: { mnemonic: string }) => {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  const words = mnemonic.trim().split(/\s+/);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; the grid is the primary surface
    }
  };

  return (
    <div>
      <ol
        className="grid grid-cols-3 gap-2 font-mono text-sm sm:text-base"
        aria-label={t("Backup phrase")}
      >
        {words.map((word, index) => (
          <li
            key={`${index}-${word}`}
            className="flex items-center gap-2 min-h-11 px-3 rounded-lg border border-panel-edge bg-panel-elevated"
          >
            <span className="text-muted tabular-nums w-6 shrink-0 text-right">
              {index + 1}.
            </span>
            <span className="select-none">{word}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={copy}
        className="mt-4 inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-lg border border-panel-edge text-muted hover:text-foreground hover:bg-panel-elevated transition-colors touch-manipulation"
      >
        {copied ? (
          <Check className="w-4 h-4 text-success" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
        {copied ? t("Copied") : t("Copy phrase")}
      </button>
    </div>
  );
};
