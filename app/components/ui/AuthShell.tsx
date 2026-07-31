"use client";

import { Zap } from "lucide-react";
import { PropsWithChildren, ReactNode } from "react";

interface AuthShellProps extends PropsWithChildren {
  subtitle: string;
  topLeft?: ReactNode;
}

/** Shared auth composition: static Zap brand mark (never pulses). */
export const AuthShell = ({ subtitle, topLeft, children }: AuthShellProps) => {
  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="relative w-full max-w-md bg-panel rounded-xl border border-panel-edge p-6 sm:p-8 space-y-6 animate-fade-in-up">
        {topLeft}
        <div className="text-center pt-2">
          <Zap
            className="w-14 h-14 text-accent mx-auto mb-4"
            aria-hidden="true"
          />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Aratiri
          </h1>
          <p className="text-muted mt-1 text-sm sm:text-base">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
};
