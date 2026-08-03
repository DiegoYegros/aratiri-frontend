"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";

export const SparkFeeLine = ({
  estimateSats,
  maxFeeSats,
  onMaxFeeChange,
  busy = false,
}: {
  estimateSats: number | null;
  maxFeeSats: number;
  onMaxFeeChange: (value: number) => void;
  busy?: boolean;
}) => {
  const t = useTranslation();
  const overCap =
    estimateSats !== null && maxFeeSats > 0 && estimateSats > maxFeeSats;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {t("Spark fee (0.25% + routing)")}
        </span>
        <span className="font-amount">
          {busy
            ? t("Estimating...")
            : estimateSats !== null
              ? t("≈ {fee} sats", { fee: estimateSats.toLocaleString() })
              : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <label htmlFor="spark-max-fee" className="text-muted">
          {t("Maximum fee cap")}
        </label>
        <input
          id="spark-max-fee"
          type="number"
          inputMode="numeric"
          min={1}
          value={maxFeeSats}
          onChange={(e) => onMaxFeeChange(Number(e.target.value))}
          className="w-28 min-h-11 px-3 text-right bg-input border border-panel-edge rounded-lg font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      {overCap && (
        <Alert variant="warning">
          {t(
            "The estimated fee exceeds your cap. Payment will be rejected above this cap."
          )}
        </Alert>
      )}
    </div>
  );
};
