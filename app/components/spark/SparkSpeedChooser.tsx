"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

export type ExitSpeedValue = "FAST" | "MEDIUM" | "SLOW";

interface CoopExitFeeQuoteLike {
  userFeeFast: { originalValue: number };
  userFeeMedium: { originalValue: number };
  userFeeSlow: { originalValue: number };
  l1BroadcastFeeFast: { originalValue: number };
  l1BroadcastFeeMedium: { originalValue: number };
  l1BroadcastFeeSlow: { originalValue: number };
}

const SPEEDS: ExitSpeedValue[] = ["FAST", "MEDIUM", "SLOW"];

export const SparkSpeedChooser = ({
  quote,
  speed,
  onChange,
}: {
  quote: CoopExitFeeQuoteLike;
  speed: ExitSpeedValue;
  onChange: (speed: ExitSpeedValue) => void;
}) => {
  const t = useTranslation();

  const totals: Record<ExitSpeedValue, number> = {
    FAST: quote.userFeeFast.originalValue + quote.l1BroadcastFeeFast.originalValue,
    MEDIUM:
      quote.userFeeMedium.originalValue +
      quote.l1BroadcastFeeMedium.originalValue,
    SLOW: quote.userFeeSlow.originalValue + quote.l1BroadcastFeeSlow.originalValue,
  };

  const timeLabel: Record<ExitSpeedValue, string> = {
    FAST: t("≈ minutes"),
    MEDIUM: t("≈ hours"),
    SLOW: t("≈ days"),
  };

  return (
    <div role="radiogroup" aria-label={t("Withdrawal speed")} className="space-y-2">
      {SPEEDS.map((value) => {
        const label = t(value);
        const selected = speed === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={`w-full min-h-12 text-left px-4 py-3 rounded-lg border transition-colors touch-manipulation ${
              selected
                ? "border-accent bg-accent-subtle/40"
                : "border-panel-edge bg-panel-elevated hover:border-accent/50"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{label}</span>
              <span className="text-xs text-muted">{timeLabel[value]}</span>
            </span>
            <span className="block text-sm text-muted mt-1 font-amount">
              {t("Fee: {fee} sats", { fee: totals[value].toLocaleString() })}
            </span>
          </button>
        );
      })}
    </div>
  );
};
