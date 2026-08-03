"use client";

import { Zap } from "lucide-react";
import { PropsWithChildren, ReactNode } from "react";

interface AuthShellProps extends PropsWithChildren {
  /** Brand-plane supporting line under Aratiri. */
  subtitle: string;
  /** Rail heading above the form (e.g. Sign In). */
  railTitle?: string;
  /** Back control — placed at top of the auth rail. */
  topLeft?: ReactNode;
  /**
   * login: lock document scroll; stage + rail fill one dvh.
   * form: longer flows; rail scrolls; page may grow on mobile.
   */
  variant?: "login" | "form";
  /** Guest Spark entry — under the centered brand cluster. */
  sparkSlot?: ReactNode;
}

/**
 * Quiet Edge auth composition: full-bleed brand stage + flush instrument rail.
 * Brand + rail content are centered within their planes. Zap never pulses.
 */
export const AuthShell = ({
  subtitle,
  railTitle,
  topLeft,
  variant = "form",
  sparkSlot,
  children,
}: AuthShellProps) => {
  const lockViewport = variant === "login";

  return (
    <div
      className={
        lockViewport
          ? "h-dvh overflow-hidden bg-background text-foreground font-sans"
          : "min-h-dvh overflow-y-auto bg-background text-foreground font-sans"
      }
    >
      <div
        className={`flex w-full flex-col lg:flex-row ${
          lockViewport ? "h-dvh" : "min-h-dvh lg:h-dvh"
        }`}
      >
        <section
          className="relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-background lg:min-h-0 lg:flex-1"
          aria-label="Aratiri"
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: [
                  "radial-gradient(90% 70% at 50% 45%, rgba(201,162,39,0.08), transparent 58%)",
                  "radial-gradient(70% 45% at 50% 0%, rgba(255,255,255,0.03), transparent 50%)",
                ].join(","),
              }}
            />
            <div className="absolute left-1/2 top-[62%] h-px w-[min(42%,20rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          </div>

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 py-8 text-center sm:px-10 lg:px-12 max-lg:min-h-[30dvh] max-lg:max-h-64 max-lg:py-6">
            <div className="flex max-w-lg flex-col items-center">
              <Zap
                className="mb-3 h-8 w-8 text-accent sm:mb-4 sm:h-10 sm:w-10 lg:h-12 lg:w-12"
                aria-hidden="true"
              />
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[clamp(3.5rem,7vw,5.5rem)] lg:leading-none">
                Aratiri
              </h1>
              <p className="mt-3 text-sm text-muted sm:text-base lg:mt-4 lg:text-lg">
                {subtitle}
              </p>

              {sparkSlot ? (
                <div className="mt-6 flex justify-center lg:mt-10">
                  {sparkSlot}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className={`relative flex min-h-0 w-full flex-col border-t border-panel-edge bg-panel lg:h-full lg:w-[min(400px,38vw)] lg:min-w-[340px] lg:shrink-0 lg:border-l lg:border-t-0 ${
            lockViewport
              ? "flex-1 overflow-y-auto overscroll-contain"
              : "flex-1 overflow-y-auto"
          }`}
        >
          <div
            className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6 sm:px-8 sm:py-8 lg:max-w-none lg:px-8 lg:py-7 [@media(min-width:1024px)_and_(max-height:720px)]:py-5 ${
              lockViewport ? "lg:justify-center" : ""
            }`}
          >
            {topLeft ? (
              <div className="mb-4 flex items-center">{topLeft}</div>
            ) : null}

            {railTitle ? (
              <h2 className="mb-5 text-center text-sm font-medium uppercase tracking-[0.14em] text-muted-strong lg:mb-6 [@media(min-width:1024px)_and_(max-height:720px)]:mb-4">
                {railTitle}
              </h2>
            ) : null}

            <div className="flex flex-col space-y-4 [@media(min-width:1024px)_and_(max-height:720px)]:space-y-3">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
