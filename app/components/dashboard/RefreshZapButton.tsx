"use client";

import { Zap } from "lucide-react";

interface RefreshZapButtonProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  label: string;
  busyLabel: string;
}

/**
 * Sole dashboard refresh control. Adjacent wordmark must remain static.
 * Spin is 1.5s smooth; reduced-motion uses calm opacity busy state instead.
 */
export const RefreshZapButton = ({
  isRefreshing,
  onRefresh,
  label,
  busyLabel,
}: RefreshZapButtonProps) => {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-busy={isRefreshing}
      aria-label={isRefreshing ? busyLabel : label}
      data-testid="refresh-zap"
      className="inline-flex items-center justify-center min-h-11 min-w-11 h-11 w-11 rounded-lg text-accent hover:bg-accent-subtle transition-colors disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Zap
        aria-hidden="true"
        className={`refresh-zap-icon w-7 h-7 ${
          isRefreshing ? "animate-spin-smooth is-busy" : ""
        }`}
      />
    </button>
  );
};
