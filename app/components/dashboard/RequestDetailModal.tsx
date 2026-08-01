"use client";

import { Check, ClipboardCopy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiCall, PaymentRequest } from "../../lib/api";
import {
  getPaymentRequestShareUrl,
  isCancellablePaymentRequest,
  mergePaymentRequestMonotonic,
  normalizePaymentRequestStatus,
  PAYMENT_REQUEST_POLL_INTERVAL_MS,
  PaymentRequestStatus,
  shouldAcceptPaymentRequestStatusUpdate,
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

const statusLabelKey: Record<PaymentRequestStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

const statusBadgeClass: Record<PaymentRequestStatus | "unknown", string> = {
  pending: "bg-accent-subtle text-pending border-accent/30",
  paid: "bg-success-bg text-success border-success/30",
  expired: "bg-panel-elevated text-muted border-panel-edge",
  cancelled: "bg-danger-bg text-danger border-danger/30",
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
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [copiedField, setCopiedField] = useState<"link" | "invoice" | null>(
    null
  );
  const [showShareButton, setShowShareButton] = useState(false);
  const [feedback, setFeedback] = useState("");
  /** Latest known status for poll decisions (detail load, list sync, cancel). */
  const knownStatusRef = useRef<PaymentRequestStatus | "unknown">("unknown");
  /** Mirrors detail state for material-change checks without stale closures. */
  const requestRef = useRef<PaymentRequest | null>(null);
  const clearPollRef = useRef<(() => void) | null>(null);
  /**
   * Bumped on terminal transitions so any in-flight GET started while OPEN is
   * ignored after cancel or list/WebSocket terminal sync.
   */
  const loadGenerationRef = useRef(0);
  const invalidateInFlightLoadsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

  // Apply list/WebSocket refreshes without a second socket or loading flicker.
  // Stale OPEN rows must not regress a known terminal detail (or restart poll/QR).
  useEffect(() => {
    if (!listRequest || listRequest.public_id !== publicId) return;

    const baseline = requestRef.current;
    const known = knownStatusRef.current;
    const currentStatus =
      known !== "unknown" ? known : (baseline?.status ?? listRequest.status);

    if (
      !shouldAcceptPaymentRequestStatusUpdate(
        currentStatus,
        listRequest.status
      )
    ) {
      setLoading(false);
      setError("");
      return;
    }

    const merged = baseline
      ? mergePaymentRequestMonotonic(baseline, listRequest)
      : listRequest;

    if (!baseline || !isMateriallySameRequest(baseline, merged)) {
      requestRef.current = merged;
      setRequest(merged);
    }

    const status = normalizePaymentRequestStatus(merged.status);
    knownStatusRef.current = status;
    if (status !== "pending") {
      invalidateInFlightLoadsRef.current?.();
      clearPollRef.current?.();
    }
    setLoading(false);
    setError("");
  }, [listRequest, publicId]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearPoll = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    clearPollRef.current = clearPoll;

    const invalidateInFlightLoads = () => {
      loadGenerationRef.current += 1;
    };
    invalidateInFlightLoadsRef.current = invalidateInFlightLoads;

    const schedulePoll = () => {
      clearPoll();
      if (cancelled) return;
      // Only poll while the latest known status is still OPEN/pending.
      if (knownStatusRef.current !== "pending") return;
      timeoutId = setTimeout(() => {
        void load({ isRefresh: true });
      }, PAYMENT_REQUEST_POLL_INTERVAL_MS);
    };

    const load = async ({ isRefresh }: { isRefresh: boolean }) => {
      if (cancelled || inFlight) return;
      inFlight = true;
      const generation = loadGenerationRef.current;
      if (!isRefresh) {
        setLoading(true);
        setError("");
      }
      try {
        const data = (await apiCall(
          `/payment-requests/${encodeURIComponent(publicId)}`
        )) as PaymentRequest;
        // Ignore after unmount or generation invalidation (terminal race).
        if (cancelled || generation !== loadGenerationRef.current) return;
        // Accept unknown initial state; ignore only after a known terminal status.
        const known = knownStatusRef.current;
        if (known !== "pending" && known !== "unknown") return;
        const previous = requestRef.current;
        const changed = !previous || !isMateriallySameRequest(previous, data);
        requestRef.current = data;
        setRequest(data);
        if (changed) {
          onUpdatedRef.current(data);
        }
        const status = normalizePaymentRequestStatus(data.status);
        knownStatusRef.current = status;
        if (status === "pending") {
          schedulePoll();
        } else {
          clearPoll();
        }
      } catch (err: unknown) {
        if (cancelled || generation !== loadGenerationRef.current) return;
        if (isRefresh) {
          // Errors may reschedule only while still OPEN/pending.
          if (knownStatusRef.current === "pending") {
            schedulePoll();
          }
          return;
        }
        const message =
          err instanceof Error ? err.message : t("Failed to load request.");
        setError(message);
      } finally {
        if (!cancelled && !isRefresh) setLoading(false);
        inFlight = false;
      }
    };

    void load({ isRefresh: false });
    return () => {
      cancelled = true;
      clearPoll();
      clearPollRef.current = null;
      invalidateInFlightLoadsRef.current = null;
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
      // Ignore share failures; copy-link remains available.
    }
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
      knownStatusRef.current = normalizePaymentRequestStatus(updated.status);
      invalidateInFlightLoadsRef.current?.();
      clearPollRef.current?.();
      requestRef.current = updated;
      setRequest(updated);
      setCancelConfirm(false);
      setFeedback(t("Request cancelled"));
      onUpdated(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("Failed to cancel request.");
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  };

  const status = request
    ? normalizePaymentRequestStatus(request.status)
    : "unknown";
  const shareUrl = request
    ? getPaymentRequestShareUrl(request.public_id, request.share_url)
    : "";
  const amountLabel = request
    ? balanceVisible
      ? `${formatSats(request.amount_sats, locale)} sats`
      : "•••••••"
    : "";

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

      {!loading && error && <Alert variant="danger">{error}</Alert>}

      {!loading && request && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xl font-semibold font-amount tracking-tight">
              {amountLabel}
            </p>
            <span
              className={`inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border ${statusBadgeClass[status]}`}
            >
              {status === "unknown"
                ? request.status
                : t(statusLabelKey[status])}
            </span>
          </div>

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

          {status === "pending" && request.payment_request && (
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

            {request.payment_request && (
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

          {isCancellablePaymentRequest(request) && !cancelConfirm && (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="w-full min-h-11 bg-danger-bg border border-danger/30 text-danger font-semibold py-3 px-4 rounded-lg hover:bg-danger/20 transition touch-manipulation"
            >
              {t("Cancel Request")}
            </button>
          )}

          {cancelConfirm && (
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
