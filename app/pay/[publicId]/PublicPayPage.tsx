"use client";

import { Check, ClipboardCopy, Share2, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  fetchPublicPaymentRequest,
  PaymentRequest,
} from "@/app/lib/api";
import {
  getPaymentRequestShareUrl,
  normalizePaymentRequestStatus,
  PAYMENT_REQUEST_POLL_INTERVAL_MS,
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
  | { kind: "ready"; request: PaymentRequest };

const statusLabelKey: Record<PaymentRequestStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

const isAbortError = (err: unknown): boolean =>
  Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError"
  );

const getErrorStatus = (err: unknown): number | undefined => {
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
};

/** Network failures, 429, and 5xx are worth retrying on background refresh. */
const isRetryableRefreshError = (err: unknown): boolean => {
  const status = getErrorStatus(err);
  if (status === undefined) return true;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
};

export const PublicPayPage = ({ publicId }: PublicPayPageProps) => {
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [copiedField, setCopiedField] = useState<"link" | "invoice" | null>(
    null
  );
  const [feedback, setFeedback] = useState("");
  const [showShareButton, setShowShareButton] = useState(false);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

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

    const schedulePoll = () => {
      clearPoll();
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        void load({ isRefresh: true });
      }, PAYMENT_REQUEST_POLL_INTERVAL_MS);
    };

    const load = async ({ isRefresh }: { isRefresh: boolean }) => {
      if (cancelled || inFlight) return;
      inFlight = true;
      if (!isRefresh) {
        setState({ kind: "loading" });
      }
      try {
        const request = await fetchPublicPaymentRequest(publicId);
        if (cancelled) return;
        setState({ kind: "ready", request });
        const status = normalizePaymentRequestStatus(request.status);
        if (status === "pending") {
          schedulePoll();
        } else {
          clearPoll();
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const status = getErrorStatus(err);
        if (isRefresh) {
          if (status === 404) {
            clearPoll();
            setState({ kind: "not_found" });
            return;
          }
          if (!isRetryableRefreshError(err)) {
            // 410 and other definitive non-retryable 4xx: stop and show terminal error.
            clearPoll();
            setState({
              kind: "error",
              message: t("This payment request is unavailable."),
            });
            return;
          }
          // Transient network/5xx/429: keep last visible state and retry.
          schedulePoll();
          return;
        }
        if (status === 404) {
          setState({ kind: "not_found" });
        } else {
          const message =
            err instanceof Error ? err.message : t("Failed to load payment.");
          setState({ kind: "error", message });
        }
      } finally {
        inFlight = false;
      }
    };

    void load({ isRefresh: false });
    return () => {
      cancelled = true;
      clearPoll();
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
      <Alert variant="danger">{t("Payment request not found.")}</Alert>
    );
  }

  if (state.kind === "error") {
    return shell(<Alert variant="danger">{state.message}</Alert>);
  }

  const { request } = state;
  const status = normalizePaymentRequestStatus(request.status);
  const shareUrl = getPaymentRequestShareUrl(
    request.public_id,
    request.share_url
  );
  const amountLabel = `${formatSats(request.amount_sats, locale)} sats`;

  if (status === "paid") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="success">{t("This request has been paid.")}</Alert>
        <p className="text-3xl font-semibold font-amount">{amountLabel}</p>
        {request.memo && <p className="text-muted text-sm">{request.memo}</p>}
      </div>
    );
  }

  if (status === "expired") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="warning">{t("This payment request has expired.")}</Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
      </div>
    );
  }

  if (status === "cancelled") {
    return shell(
      <div className="space-y-4 text-center" role="status">
        <Alert variant="danger">
          {t("This payment request was cancelled.")}
        </Alert>
        <p className="text-3xl font-semibold font-amount text-muted">
          {amountLabel}
        </p>
      </div>
    );
  }

  if (status !== "pending") {
    return shell(
      <div className="space-y-4 text-center">
        <Alert variant="warning">
          {t("This payment request is unavailable.")}
        </Alert>
        <p className="text-muted text-sm">
          {status === "unknown" ? request.status : t(statusLabelKey[status])}
        </p>
      </div>
    );
  }

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
        <span className="inline-flex items-center min-h-8 px-3 text-sm font-medium rounded-md border bg-accent-subtle text-pending border-accent/30">
          {t("Pending")}
        </span>
      </div>

      {request.payment_request && (
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
