"use client";

import { Check, ClipboardCopy, Share2, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  fetchPublicPaymentRequest,
  PaymentRequest,
} from "@/app/lib/api";
import {
  clearPaymentRequestInvoiceIfNotOpen,
  getActivePaymentRequestPollIntervalMs,
  getEffectivePaymentRequestStatus,
  getErrorStatus,
  getMsUntilPaymentRequestLocalExpiry,
  getNextPaymentRequestBackoffMs,
  PAYMENT_REQUEST_MAX_TIMER_MS,
  getPaymentRequestShareUrl,
  isActiveReconcilableStatus,
  isFinalPaymentRequestStatus,
  isPayablePaymentRequest,
  isTerminalReconcilableStatus,
  isTransientPaymentRequestError,
  mergePaymentRequestMonotonic,
  needsPaymentRequestReconciliation,
  normalizePaymentRequestStatus,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS,
  PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS,
  PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT,
  paymentRequestStatusLabelKey,
  PaymentRequestStatus,
} from "@/app/lib/paymentRequests";
import { formatSats } from "@/app/lib/format";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";
import { Alert } from "@/app/components/ui/Alert";
import { IconButton } from "@/app/components/ui/IconButton";
import { LocalQrCode } from "@/app/components/ui/LocalQrCode";

interface PublicPayPageProps {
  publicId: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "unavailable" }
  | { kind: "ready"; request: PaymentRequest };

const statusBadgeClass: Record<PaymentRequestStatus | "unknown", string> = {
  provisioning: "bg-accent-subtle text-pending border-accent/30",
  open: "bg-accent-subtle text-pending border-accent/30",
  cancel_pending: "bg-accent-subtle text-pending border-accent/30",
  paid: "bg-success-bg text-success border-success/30",
  expired: "bg-panel-elevated text-muted border-panel-edge",
  cancelled: "bg-danger-bg text-danger border-danger/30",
  failed: "bg-danger-bg text-danger border-danger/30",
  unknown: "bg-panel-elevated text-muted border-panel-edge",
};

const isAbortError = (err: unknown): boolean =>
  Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError"
  );

export const PublicPayPage = ({ publicId }: PublicPayPageProps) => {
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedField, setCopiedField] = useState<"link" | "invoice" | null>(
    null
  );
  const [feedback, setFeedback] = useState("");
  const [showShareButton, setShowShareButton] = useState(false);
  /** Forces re-render when local expiry crosses without a network update. */
  const [, setExpiryTick] = useState(0);

  const requestRef = useRef<PaymentRequest | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  const terminalSeenAtRef = useRef<number | null>(null);
  const backoffMsRef = useRef<number | null>(null);
  const consecutive404Ref = useRef(0);
  const consecutiveTransientRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const loadRef = useRef<
    ((opts: { isRefresh: boolean; manual?: boolean }) => Promise<void>) | null
  >(null);
  const schedulePollRef = useRef<((delayMs: number) => void) | null>(null);
  const restartBudgetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGenerationRef.current += 1;
    inFlightRef.current = false;
    backoffMsRef.current = null;
    pollStartedAtRef.current = null;
    terminalSeenAtRef.current = null;
    consecutive404Ref.current = 0;
    consecutiveTransientRef.current = 0;
    requestRef.current = null;
    setState({ kind: "loading" });
    setCheckingStatus(false);

    const clearPollTimer = () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const clearExpiryTimer = () => {
      if (expiryTimerRef.current !== null) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };

    const isDocumentHidden = () =>
      typeof document !== "undefined" && document.hidden;

    const trackTerminal = (current: PaymentRequest, now: number) => {
      const effective = getEffectivePaymentRequestStatus(current, now);
      if (isFinalPaymentRequestStatus(effective)) {
        terminalSeenAtRef.current = null;
        pollStartedAtRef.current = null;
      } else if (isTerminalReconcilableStatus(effective)) {
        if (terminalSeenAtRef.current === null) {
          terminalSeenAtRef.current = now;
        }
      } else if (isActiveReconcilableStatus(effective)) {
        terminalSeenAtRef.current = null;
      }
    };

    const applyRequest = (incoming: PaymentRequest): PaymentRequest => {
      const baseline = requestRef.current;
      const merged = baseline
        ? mergePaymentRequestMonotonic(baseline, incoming)
        : clearPaymentRequestInvoiceIfNotOpen(incoming);
      requestRef.current = merged;
      setState({ kind: "ready", request: merged });
      trackTerminal(merged, Date.now());
      return merged;
    };

    const pageNeedsPoll = (
      current: PaymentRequest | null,
      now: number
    ): { needed: boolean; useTerminalInterval: boolean } => {
      if (!current) return { needed: false, useTerminalInterval: false };
      if (!needsPaymentRequestReconciliation(current, now)) {
        return { needed: false, useTerminalInterval: false };
      }
      const effective = getEffectivePaymentRequestStatus(current, now);
      if (isActiveReconcilableStatus(effective)) {
        return { needed: true, useTerminalInterval: false };
      }
      if (isTerminalReconcilableStatus(effective)) {
        const seenAt = terminalSeenAtRef.current ?? now;
        if (terminalSeenAtRef.current === null) {
          terminalSeenAtRef.current = seenAt;
        }
        if (now - seenAt <= PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS) {
          return { needed: true, useTerminalInterval: true };
        }
      }
      return { needed: false, useTerminalInterval: false };
    };

    const scheduleExpiryTick = () => {
      clearExpiryTimer();
      if (cancelled) return;
      const current = requestRef.current;
      if (!current) return;
      const ms = getMsUntilPaymentRequestLocalExpiry(current, Date.now());
      if (ms === null || ms <= 0) return;
      expiryTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setExpiryTick((n) => n + 1);
        scheduleExpiryTick();
        schedulePoll(0);
      }, Math.min(ms, PAYMENT_REQUEST_MAX_TIMER_MS));
    };

    const scheduleNextAfterSuccess = (merged: PaymentRequest) => {
      const after = Date.now();
      const next = pageNeedsPoll(merged, after);
      if (!next.needed) {
        pollStartedAtRef.current = null;
        clearPollTimer();
        scheduleExpiryTick();
        return;
      }
      if (pollStartedAtRef.current === null) {
        pollStartedAtRef.current = after;
      }
      if (next.useTerminalInterval) {
        schedulePoll(PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS);
      } else {
        const elapsed = after - (pollStartedAtRef.current ?? after);
        schedulePoll(getActivePaymentRequestPollIntervalMs(elapsed));
      }
      scheduleExpiryTick();
    };

    const schedulePoll = (delayMs: number) => {
      clearPollTimer();
      if (cancelled || isDocumentHidden()) return;
      const now = Date.now();
      const { needed } = pageNeedsPoll(requestRef.current, now);
      if (
        !needed &&
        backoffMsRef.current === null &&
        consecutive404Ref.current === 0
      ) {
        return;
      }
      pollTimerRef.current = setTimeout(() => {
        void runPoll();
      }, Math.max(0, delayMs));
    };
    schedulePollRef.current = schedulePoll;

    /** Queued Restart/Retry while a GET is in flight. */
    let pendingRestart = false;

    const runPoll = async () => {
      if (cancelled || isDocumentHidden() || inFlightRef.current) return;
      await load({ isRefresh: true });
    };

    const showExhausted = (hadKnown: boolean, was404: boolean) => {
      clearPollTimer();
      setCheckingStatus(false);
      requestRef.current = null;
      if (was404 || !hadKnown) {
        setState(
          was404
            ? { kind: "not_found" }
            : {
                kind: "error",
                message: t("Failed to load payment."),
              }
        );
      } else {
        setState({
          kind: "error",
          message: t("Failed to load payment."),
        });
      }
    };

    const load = async ({
      isRefresh,
      manual = false,
    }: {
      isRefresh: boolean;
      manual?: boolean;
    }) => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      const generation = loadGenerationRef.current;
      const hadKnown = requestRef.current !== null;

      if (!isRefresh) {
        if (!hadKnown) {
          setState({ kind: "loading" });
        }
        setCheckingStatus(false);
      } else if (manual || backoffMsRef.current !== null) {
        // Mirror owner detail: uncertain/retry/manual only — not every healthy poll.
        setCheckingStatus(true);
      }

      try {
        const incoming = await fetchPublicPaymentRequest(publicId);
        if (cancelled || generation !== loadGenerationRef.current) return;

        consecutive404Ref.current = 0;
        consecutiveTransientRef.current = 0;
        backoffMsRef.current = null;
        setCheckingStatus(false);

        const previous = requestRef.current;
        const beforeStatus = previous
          ? normalizePaymentRequestStatus(previous.status)
          : "unknown";
        const merged = applyRequest(incoming);
        const afterStatus = normalizePaymentRequestStatus(merged.status);
        if (beforeStatus !== afterStatus) {
          loadGenerationRef.current += 1;
        }

        scheduleNextAfterSuccess(merged);
      } catch (err: unknown) {
        if (cancelled || generation !== loadGenerationRef.current) return;
        const status = getErrorStatus(err);

        if (status === 410) {
          clearPollTimer();
          setCheckingStatus(false);
          requestRef.current = null;
          setState({ kind: "unavailable" });
          return;
        }

        if (status === 404) {
          consecutive404Ref.current += 1;
          consecutiveTransientRef.current = 0;
          if (consecutive404Ref.current >= PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT) {
            showExhausted(hadKnown, true);
            return;
          }
          if (hadKnown) {
            setCheckingStatus(true);
          } else {
            setState({ kind: "loading" });
          }
          schedulePoll(PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS);
          return;
        }

        if (isTransientPaymentRequestError(err)) {
          consecutiveTransientRef.current += 1;
          if (
            !hadKnown &&
            consecutiveTransientRef.current >= PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT
          ) {
            showExhausted(false, false);
            return;
          }
          if (
            hadKnown &&
            consecutiveTransientRef.current >= PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT
          ) {
            showExhausted(true, false);
            return;
          }
          backoffMsRef.current = getNextPaymentRequestBackoffMs(
            backoffMsRef.current
          );
          if (hadKnown) {
            setCheckingStatus(true);
          } else {
            setState({ kind: "loading" });
          }
          schedulePoll(backoffMsRef.current);
          return;
        }

        // Definitive non-retryable error.
        clearPollTimer();
        setCheckingStatus(false);
        requestRef.current = null;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : t("This payment request is unavailable."),
        });
      } finally {
        if (cancelled) {
          // Newer effect owns inFlightRef; do not clear or drain here.
          return;
        }
        inFlightRef.current = false;
        void manual;
        if (pendingRestart) {
          pendingRestart = false;
          consecutive404Ref.current = 0;
          consecutiveTransientRef.current = 0;
          backoffMsRef.current = null;
          setCheckingStatus(false);
          clearPollTimer();
          void load({ isRefresh: false, manual: true });
        }
      }
    };
    loadRef.current = load;

    const restartBudget = () => {
      consecutive404Ref.current = 0;
      consecutiveTransientRef.current = 0;
      backoffMsRef.current = null;
      setCheckingStatus(false);
      // Invalidate any in-flight GET so Retry always starts a fresh budgeted load.
      loadGenerationRef.current += 1;
      if (inFlightRef.current) {
        pendingRestart = true;
        return;
      }
      clearPollTimer();
      void load({ isRefresh: false, manual: true });
    };
    restartBudgetRef.current = restartBudget;

    const onVisibilityOrFocus = () => {
      if (cancelled) return;
      if (isDocumentHidden()) {
        clearPollTimer();
        return;
      }
      schedulePoll(0);
    };

    void load({ isRefresh: false });

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
      clearPollTimer();
      clearExpiryTimer();
      schedulePollRef.current = null;
      loadRef.current = null;
      restartBudgetRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [publicId, t]);

  const copyText = async (text: string, field: "link" | "invoice") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setFeedback(
        field === "link" ? t("Link copied") : t("Invoice copied")
      );
      setTimeout(() => {
        setCopiedField(null);
        setFeedback("");
      }, 2000);
    } catch {
      setFeedback(t("Could not copy to clipboard."));
    }
  };

  const handleShare = async (shareUrl: string) => {
    try {
      await navigator.share({
        title: t("Payment Request"),
        text: t("Pay this Lightning request"),
        url: shareUrl,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) return;
    }
  };

  const handleRetry = () => {
    restartBudgetRef.current?.();
  };

  const shell = (children: ReactNode) => (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-panel rounded-xl border border-panel-edge p-6 sm:p-8 space-y-6 animate-fade-in-up">
        <div className="text-center">
          <Zap
            className="w-12 h-12 text-accent mx-auto mb-3"
            aria-hidden="true"
          />
          <h1 className="text-3xl font-semibold tracking-tight">Aratiri</h1>
          <p className="text-muted mt-1 text-sm">{t("Payment Request")}</p>
        </div>
        {children}
      </div>
    </div>
  );

  const retryButton = (
    <button
      type="button"
      onClick={handleRetry}
      className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition touch-manipulation"
    >
      {t("Retry")}
    </button>
  );

  if (state.kind === "loading") {
    return shell(
      <div
        className="py-8 text-center text-muted"
        role="status"
        aria-live="polite"
        aria-label={t("Loading payment")}
      >
        <Zap
          className="w-10 h-10 text-accent mx-auto mb-3 animate-calm-busy"
          aria-hidden="true"
        />
        {t("Loading payment...")}
      </div>
    );
  }

  if (state.kind === "not_found") {
    return shell(
      <div className="space-y-3">
        <Alert variant="danger">{t("Payment request not found.")}</Alert>
        {retryButton}
      </div>
    );
  }

  if (state.kind === "unavailable") {
    return shell(
      <Alert variant="danger">
        {t("This payment request is unavailable.")}
      </Alert>
    );
  }

  if (state.kind === "error") {
    return shell(
      <div className="space-y-3">
        <Alert variant="danger">{state.message}</Alert>
        {retryButton}
      </div>
    );
  }

  const { request } = state;
  const effective = getEffectivePaymentRequestStatus(request);
  const shareUrl = getPaymentRequestShareUrl(
    request.public_id,
    request.share_url
  );
  const amountLabel = `${formatSats(request.amount_sats, locale)} sats`;
  const payable = isPayablePaymentRequest(request);
  const checkingBanner = checkingStatus ? (
    <p className="text-sm text-muted text-center" role="status" aria-live="polite">
      {t("Checking status")}
    </p>
  ) : null;

  if (effective === "paid") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="success">{t("This request has been paid.")}</Alert>
        <p className="text-3xl font-semibold font-amount">{amountLabel}</p>
        {request.memo && <p className="text-muted text-sm">{request.memo}</p>}
        {checkingBanner}
      </div>
    );
  }

  if (effective === "expired") {
    const confirming =
      normalizePaymentRequestStatus(request.status) === "open";
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="warning">
          {confirming
            ? t("This payment request has expired. Confirming status...")
            : t("This payment request has expired.")}
        </Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
        {checkingBanner}
      </div>
    );
  }

  if (effective === "cancelled") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="danger">
          {t("This payment request was cancelled.")}
        </Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
        {checkingBanner}
      </div>
    );
  }

  if (effective === "failed") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="danger">{t("This payment request failed.")}</Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
        {checkingBanner}
      </div>
    );
  }

  if (effective === "provisioning") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="warning">
          {t("This payment request is being prepared.")}
        </Alert>
        <p className="text-3xl font-semibold font-amount">{amountLabel}</p>
        {request.memo && (
          <p className="text-muted text-sm break-words">{request.memo}</p>
        )}
        <span
          className={`inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border ${statusBadgeClass.provisioning}`}
        >
          {t(paymentRequestStatusLabelKey.provisioning)}
        </span>
        {checkingBanner}
      </div>
    );
  }

  if (effective === "cancel_pending") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="warning">
          {t("This payment request is being cancelled.")}
        </Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
        <span
          className={`inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border ${statusBadgeClass.cancel_pending}`}
        >
          {t(paymentRequestStatusLabelKey.cancel_pending)}
        </span>
        {checkingBanner}
      </div>
    );
  }

  if (effective !== "open") {
    return shell(
      <div className="space-y-4 text-center">
        <Alert variant="warning">
          {t("This payment request is unavailable.")}
        </Alert>
        <p className="text-muted text-sm">
          {effective === "unknown"
            ? request.status
            : t(paymentRequestStatusLabelKey[effective])}
        </p>
        {checkingBanner}
      </div>
    );
  }

  // Exact OPEN + unexpired. Pay actions only when bolt11 present and payable.
  return shell(
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-4xl font-semibold font-amount tracking-tight">
          {amountLabel}
        </p>
        {request.memo && (
          <p className="text-muted text-sm break-words">{request.memo}</p>
        )}
        {request.expires_at && (
          <p className="text-xs text-muted">
            {t("Expires")}:{" "}
            <span className="font-amount">
              {new Date(request.expires_at).toLocaleString(locale)}
            </span>
          </p>
        )}
        <span
          className={`inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border ${statusBadgeClass.open}`}
        >
          {t(paymentRequestStatusLabelKey.open)}
        </span>
      </div>

      {checkingBanner}

      {payable && request.payment_request && (
        <>
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block">
              <LocalQrCode
                value={request.payment_request}
                alt={t("Invoice QR Code")}
                size={220}
              />
            </div>
          </div>

          <div className="bg-input border border-panel-edge rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="font-address text-xs break-all text-left flex-1">
              {request.payment_request}
            </span>
            <IconButton
              label={t("Copy invoice")}
              onClick={() =>
                copyText(request.payment_request || "", "invoice")
              }
            >
              {copiedField === "invoice" ? (
                <Check size={18} className="text-success" aria-hidden="true" />
              ) : (
                <ClipboardCopy size={18} aria-hidden="true" />
              )}
            </IconButton>
          </div>

          <a
            href={`lightning:${request.payment_request}`}
            className="flex items-center justify-center w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover transition touch-manipulation"
          >
            {t("Open in Wallet")}
          </a>
        </>
      )}

      <div className="bg-input border border-panel-edge rounded-lg px-3 py-2 flex items-center justify-between gap-2">
        <span className="font-address text-xs break-all text-left flex-1">
          {shareUrl}
        </span>
        <IconButton
          label={t("Copy share link")}
          onClick={() => copyText(shareUrl, "link")}
        >
          {copiedField === "link" ? (
            <Check size={18} className="text-success" aria-hidden="true" />
          ) : (
            <ClipboardCopy size={18} aria-hidden="true" />
          )}
        </IconButton>
      </div>

      {showShareButton && (
        <button
          type="button"
          onClick={() => handleShare(shareUrl)}
          className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition flex items-center justify-center touch-manipulation"
        >
          <Share2 size={18} className="mr-2" aria-hidden="true" />
          {t("Share")}
        </button>
      )}

      <div aria-live="polite" className="sr-only">
        {feedback}
      </div>
      {feedback && <Alert variant="success">{feedback}</Alert>}
    </div>
  );
};
