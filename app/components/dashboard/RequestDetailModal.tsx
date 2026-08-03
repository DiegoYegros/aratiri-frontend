"use client";

import { Check, ClipboardCopy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiCall, PaymentRequest } from "../../lib/api";
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
  isCancellablePaymentRequest,
  isFinalPaymentRequestStatus,
  isPayablePaymentRequest,
  isTerminalReconcilableStatus,
  isTransientPaymentRequestError,
  mergePaymentRequestMonotonic,
  needsPaymentRequestReconciliation,
  normalizePaymentRequestStatus,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS,
  paymentRequestStatusLabelKey,
  PaymentRequestStatus,
} from "../../lib/paymentRequests";
import { formatSats } from "../../lib/format";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";
import { LocalQrCode } from "../ui/LocalQrCode";

interface RequestDetailModalProps {
  publicId: string;
  balanceVisible: boolean;
  /** Latest matching item from the request list (updated on list/WebSocket refresh). */
  listRequest?: PaymentRequest | null;
  onClose: () => void;
  onUpdated: (request: PaymentRequest) => void;
}

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

/** Fields that should propagate to the owner list when they change. */
const isMateriallySameRequest = (
  a: PaymentRequest,
  b: PaymentRequest
): boolean =>
  a.public_id === b.public_id &&
  a.status === b.status &&
  a.paid_at === b.paid_at &&
  a.cancelled_at === b.cancelled_at &&
  a.payment_request === b.payment_request &&
  a.amount_sats === b.amount_sats &&
  a.memo === b.memo &&
  a.expires_at === b.expires_at &&
  a.share_url === b.share_url;

export const RequestDetailModal = ({
  publicId,
  balanceVisible,
  listRequest = null,
  onClose,
  onUpdated,
}: RequestDetailModalProps) => {
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  /**
   * Local-only: transient cancel left outcome unknown. Hides QR/cancel without
   * writing CANCEL_PENDING into request status (avoids monotonic poison).
   */
  const [cancelUncertain, setCancelUncertain] = useState(false);
  const [copiedField, setCopiedField] = useState<"link" | "invoice" | null>(
    null
  );
  const [showShareButton, setShowShareButton] = useState(false);
  const [feedback, setFeedback] = useState("");
  /** Forces re-render when local expiry crosses without a network update. */
  const [, setExpiryTick] = useState(0);

  const requestRef = useRef<PaymentRequest | null>(null);
  const cancelUncertainRef = useRef(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const terminalSeenAtRef = useRef<number | null>(null);
  const backoffMsRef = useRef<number | null>(null);
  /**
   * Bumped on unmount, publicId change, and status transitions so in-flight
   * GETs started under a prior generation are ignored.
   */
  const loadGenerationRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const loadRef = useRef<
    ((opts: { isRefresh: boolean; manual?: boolean }) => Promise<void>) | null
  >(null);
  const schedulePollRef = useRef<((delayMs: number) => void) | null>(null);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

  const applyRequest = (
    incoming: PaymentRequest,
    { notify }: { notify: boolean }
  ): PaymentRequest => {
    const baseline = requestRef.current;
    const merged = baseline
      ? mergePaymentRequestMonotonic(baseline, incoming)
      : clearPaymentRequestInvoiceIfNotOpen(incoming);
    const changed = !baseline || !isMateriallySameRequest(baseline, merged);
    requestRef.current = merged;
    setRequest(merged);

    // Authoritative merge: drop local cancel uncertainty so OPEN can heal.
    if (cancelUncertainRef.current) {
      cancelUncertainRef.current = false;
      setCancelUncertain(false);
      setFeedback((current) =>
        current === t("Cancelling") ? "" : current
      );
    }

    const effective = getEffectivePaymentRequestStatus(merged);
    if (isFinalPaymentRequestStatus(effective)) {
      terminalSeenAtRef.current = null;
      pollStartedAtRef.current = null;
    } else if (isTerminalReconcilableStatus(effective)) {
      if (terminalSeenAtRef.current === null) {
        terminalSeenAtRef.current = Date.now();
      }
    } else if (isActiveReconcilableStatus(effective)) {
      terminalSeenAtRef.current = null;
    }

    if (changed && notify) {
      onUpdatedRef.current(merged);
    }
    return merged;
  };

  // Apply list/WebSocket refreshes without a second socket or loading flicker.
  useEffect(() => {
    if (!listRequest || listRequest.public_id !== publicId) return;

    const baseline = requestRef.current;
    const currentStatus = baseline?.status ?? listRequest.status;
    const merged = baseline
      ? mergePaymentRequestMonotonic(baseline, listRequest)
      : clearPaymentRequestInvoiceIfNotOpen(listRequest);

    // Stale OPEN (or other rejected) rows must not regress detail.
    if (baseline && merged === baseline && baseline.status !== listRequest.status) {
      setLoading(false);
      setError("");
      return;
    }

    if (!baseline || !isMateriallySameRequest(baseline, merged)) {
      const beforeStatus = baseline
        ? normalizePaymentRequestStatus(baseline.status)
        : "unknown";
      const afterStatus = normalizePaymentRequestStatus(merged.status);
      if (
        beforeStatus !== afterStatus &&
        (isActiveReconcilableStatus(afterStatus) ||
          isTerminalReconcilableStatus(afterStatus) ||
          isFinalPaymentRequestStatus(afterStatus))
      ) {
        loadGenerationRef.current += 1;
      }
      applyRequest(listRequest, { notify: false });
    } else if (!baseline) {
      applyRequest(listRequest, { notify: false });
    } else {
      // Touch effective/terminal tracking even when materially same.
      void currentStatus;
    }

    setLoading(false);
    setError("");
    setCheckingStatus(false);
    schedulePollRef.current?.(0);
    // applyRequest is stable in behavior via refs; listing it would re-fire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [listRequest, publicId]);

  useEffect(() => {
    let cancelled = false;
    loadGenerationRef.current += 1;
    inFlightRef.current = false;
    backoffMsRef.current = null;
    pollStartedAtRef.current = null;
    terminalSeenAtRef.current = null;
    requestRef.current = null;
    setRequest(null);
    setLoading(true);
    setError("");
    setCheckingStatus(false);
    setCancelConfirm(false);
    setCancelError("");
    cancelUncertainRef.current = false;
    setCancelUncertain(false);

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

    const detailNeedsPoll = (
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

    /** Queued when schedulePoll/runPoll/load hits an in-flight GET. */
    let pendingLoad: { isRefresh: boolean; manual?: boolean } | null = null;

    const queuePendingLoad = (opts: {
      isRefresh: boolean;
      manual?: boolean;
    }) => {
      const prev = pendingLoad;
      if (prev && !prev.isRefresh) {
        // Keep a queued full reload; it is stronger than a refresh.
        return;
      }
      if (!opts.isRefresh) {
        pendingLoad = { isRefresh: false, manual: true };
        return;
      }
      pendingLoad = {
        isRefresh: true,
        manual: Boolean(opts.manual || prev?.manual),
      };
    };

    const schedulePoll = (delayMs: number) => {
      clearPollTimer();
      if (cancelled || isDocumentHidden()) return;
      const now = Date.now();
      const { needed } = detailNeedsPoll(requestRef.current, now);
      if (!needed && backoffMsRef.current === null) return;
      pollTimerRef.current = setTimeout(() => {
        void runPoll();
      }, Math.max(0, delayMs));
    };
    schedulePollRef.current = schedulePoll;

    const runPoll = async () => {
      if (cancelled || isDocumentHidden()) return;
      if (inFlightRef.current) {
        queuePendingLoad({ isRefresh: true });
        return;
      }
      const now = Date.now();
      const { needed } = detailNeedsPoll(requestRef.current, now);
      if (!needed && backoffMsRef.current === null) return;
      await load({ isRefresh: true });
    };

    const load = async ({
      isRefresh,
      manual = false,
    }: {
      isRefresh: boolean;
      manual?: boolean;
    }) => {
      if (cancelled) return;
      if (inFlightRef.current) {
        queuePendingLoad({ isRefresh, manual });
        return;
      }
      inFlightRef.current = true;
      const generation = loadGenerationRef.current;
      if (!isRefresh) {
        setLoading(true);
        setError("");
        setCheckingStatus(false);
      } else if (manual || backoffMsRef.current !== null) {
        setCheckingStatus(true);
      }
      try {
        const data = (await apiCall(
          `/payment-requests/${encodeURIComponent(publicId)}`
        )) as PaymentRequest;
        if (cancelled || generation !== loadGenerationRef.current) return;

        const previous = requestRef.current;
        const beforeStatus = previous
          ? normalizePaymentRequestStatus(previous.status)
          : "unknown";
        const merged = applyRequest(data, { notify: true });
        const afterStatus = normalizePaymentRequestStatus(merged.status);
        if (beforeStatus !== afterStatus) {
          // Invalidate any other in-flight GETs started under the prior status.
          loadGenerationRef.current += 1;
        }

        backoffMsRef.current = null;
        setError("");
        setCheckingStatus(false);

        const after = Date.now();
        const next = detailNeedsPoll(merged, after);
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
      } catch (err: unknown) {
        if (cancelled || generation !== loadGenerationRef.current) return;
        if (isRefresh) {
          if (isTransientPaymentRequestError(err)) {
            backoffMsRef.current = getNextPaymentRequestBackoffMs(
              backoffMsRef.current
            );
            setCheckingStatus(true);
            schedulePoll(backoffMsRef.current);
            return;
          }
          // Non-transient refresh errors: keep last-known, stop autonomous poll.
          setCheckingStatus(false);
          clearPollTimer();
          return;
        }
        const message =
          err instanceof Error ? err.message : t("Failed to load request.");
        setError(message);
        setCheckingStatus(false);
      } finally {
        if (cancelled) {
          // Newer effect owns inFlightRef; do not clear or drain here.
          return;
        }
        if (!isRefresh) setLoading(false);
        inFlightRef.current = false;
        // Drain follow-up after success, error, or stale-generation ignore so
        // cancel/list/409 bumps cannot starve CANCEL_PENDING reconciliation.
        if (pendingLoad !== null) {
          const next = pendingLoad;
          pendingLoad = null;
          clearPollTimer();
          void load(next);
        }
      }
    };
    loadRef.current = load;

    const onVisibilityOrFocus = () => {
      if (cancelled) return;
      if (isDocumentHidden()) {
        clearPollTimer();
        return;
      }
      schedulePoll(0);
    };

    void load({ isRefresh: false });
    scheduleExpiryTick();

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
      clearPollTimer();
      clearExpiryTimer();
      schedulePollRef.current = null;
      loadRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
    // applyRequest closes over refs; including it would reset poll timers every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
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
      // Ignore share failures; copy-link remains available.
    }
  };

  const handleRetry = () => {
    setError("");
    void loadRef.current?.({ isRefresh: false, manual: true });
  };

  const handleCancel = async () => {
    if (!request || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const updated = (await apiCall(
        `/payment-requests/${encodeURIComponent(request.public_id)}/cancel`,
        { method: "POST" }
      )) as PaymentRequest;
      loadGenerationRef.current += 1;
      const merged = applyRequest(updated, { notify: true });
      const status = normalizePaymentRequestStatus(merged.status);
      setCancelConfirm(false);
      if (status === "cancelled") {
        setFeedback(t("Request cancelled"));
      } else if (status === "cancel_pending") {
        setFeedback(t("Cancelling"));
      }
      backoffMsRef.current = null;
      schedulePollRef.current?.(0);
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if (status === 409) {
        setCancelConfirm(false);
        setCancelError("");
        setCheckingStatus(true);
        void loadRef.current?.({ isRefresh: true, manual: true });
        return;
      }
      if (isTransientPaymentRequestError(err)) {
        // Local UI uncertainty only — do not write CANCEL_PENDING into status.
        const baseline = requestRef.current;
        if (baseline) {
          loadGenerationRef.current += 1;
          cancelUncertainRef.current = true;
          setCancelUncertain(true);
          setCancelConfirm(false);
          setFeedback(t("Cancelling"));
          setCheckingStatus(true);
          backoffMsRef.current = null;
          schedulePollRef.current?.(0);
        }
        return;
      }
      const message =
        err instanceof Error ? err.message : t("Failed to cancel request.");
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  };

  const effectiveStatus = request
    ? getEffectivePaymentRequestStatus(request)
    : "unknown";
  const shareUrl = request
    ? getPaymentRequestShareUrl(request.public_id, request.share_url)
    : "";
  const amountLabel = request
    ? balanceVisible
      ? `${formatSats(request.amount_sats, locale)} sats`
      : "•••••••"
    : "";
  const payable =
    Boolean(request && isPayablePaymentRequest(request) && !cancelUncertain);
  const cancellable =
    Boolean(
      request && isCancellablePaymentRequest(request) && !cancelUncertain
    );
  const locallyExpiredOpen =
    request &&
    normalizePaymentRequestStatus(request.status) === "open" &&
    effectiveStatus === "expired";

  return (
    <Modal
      title={t("Request Details")}
      onClose={onClose}
      labelledBy="request-detail-title"
    >
      {loading && (
        <div
          className="py-10 text-center text-muted"
          role="status"
          aria-live="polite"
        >
          {t("Loading request...")}
        </div>
      )}

      {!loading && error && !request && (
        <div className="space-y-3">
          <Alert variant="danger">{error}</Alert>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition touch-manipulation"
          >
            {t("Retry")}
          </button>
        </div>
      )}

      {!loading && request && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xl font-semibold font-amount tracking-tight">
              {amountLabel}
            </p>
            <span
              className={`inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border ${statusBadgeClass[effectiveStatus]}`}
            >
              {effectiveStatus === "unknown"
                ? request.status
                : t(paymentRequestStatusLabelKey[effectiveStatus])}
            </span>
          </div>

          {checkingStatus && (
            <p
              className="text-sm text-muted"
              role="status"
              aria-live="polite"
            >
              {t("Checking status")}
            </p>
          )}

          {locallyExpiredOpen && (
            <Alert variant="warning">
              {t("This payment request has expired. Confirming status...")}
            </Alert>
          )}

          {request.memo && (
            <p className="text-muted text-sm break-words">{request.memo}</p>
          )}

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Created")}</dt>
              <dd className="font-amount text-right">
                {new Date(request.created_at).toLocaleString(locale)}
              </dd>
            </div>
            {request.expires_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("Expires")}</dt>
                <dd className="font-amount text-right">
                  {new Date(request.expires_at).toLocaleString(locale)}
                </dd>
              </div>
            )}
            {request.paid_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("Paid at")}</dt>
                <dd className="font-amount text-right">
                  {new Date(request.paid_at).toLocaleString(locale)}
                </dd>
              </div>
            )}
            {request.cancelled_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("Cancelled at")}</dt>
                <dd className="font-amount text-right">
                  {new Date(request.cancelled_at).toLocaleString(locale)}
                </dd>
              </div>
            )}
          </dl>

          {payable && request.payment_request && (
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <LocalQrCode
                  value={request.payment_request}
                  alt={t("Invoice QR Code")}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
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

            {payable && request.payment_request && (
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
                    <Check
                      size={18}
                      className="text-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <ClipboardCopy size={18} aria-hidden="true" />
                  )}
                </IconButton>
              </div>
            )}
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

          {cancellable && !cancelConfirm && (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="w-full min-h-11 bg-danger-bg border border-danger/30 text-danger font-semibold py-3 px-4 rounded-lg hover:bg-danger/20 transition touch-manipulation"
            >
              {t("Cancel Request")}
            </button>
          )}

          {cancelConfirm && cancellable && (
            <div
              className="space-y-3 p-4 rounded-lg border border-danger/30 bg-danger-bg"
              role="group"
              aria-labelledby="cancel-confirm-label"
            >
              <p id="cancel-confirm-label" className="text-sm text-danger">
                {t("Cancel this payment request? This cannot be undone.")}
              </p>
              {cancelError && <Alert variant="danger">{cancelError}</Alert>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelConfirm(false);
                    setCancelError("");
                  }}
                  className="flex-1 min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition touch-manipulation"
                >
                  {t("Keep Request")}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  aria-busy={cancelling}
                  className="flex-1 min-h-11 bg-danger text-foreground font-semibold py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition touch-manipulation"
                >
                  {cancelling ? t("Cancelling...") : t("Confirm Cancel")}
                </button>
              </div>
            </div>
          )}

          <div aria-live="polite" className="sr-only">
            {feedback}
          </div>
          {feedback && !cancelConfirm && (
            <Alert variant="success">{feedback}</Alert>
          )}
        </div>
      )}
    </Modal>
  );
};
