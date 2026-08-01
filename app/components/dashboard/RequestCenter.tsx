"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall, PaymentRequest, PaymentRequestListResponse } from "../../lib/api";
import {
  mergePaymentRequestListMonotonic,
  mergePaymentRequestMonotonic,
  normalizePaymentRequestStatus,
  PaymentRequestStatus,
} from "../../lib/paymentRequests";
import { formatSats } from "../../lib/format";
import { formatRelativeDate } from "../../lib/time";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";
import { Alert } from "../ui/Alert";
import { IconButton } from "../ui/IconButton";
import { CreateRequestModal } from "./CreateRequestModal";
import { RequestDetailModal } from "./RequestDetailModal";

const PAGE_LIMIT = 20;

const mergeUniqueByPublicId = (
  existing: PaymentRequest[],
  incoming: PaymentRequest[]
): PaymentRequest[] => {
  const seen = new Set(existing.map((r) => r.public_id));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.public_id)) continue;
    seen.add(item.public_id);
    merged.push(item);
  }
  return merged;
};

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

interface RequestCenterProps {
  balanceVisible: boolean;
  onToggleBalanceVisibility: () => void;
  registerRefresh: (fn: (() => Promise<void>) | null) => void;
}

export const RequestCenter = ({
  balanceVisible,
  onToggleBalanceVisibility,
  registerRefresh,
}: RequestCenterProps) => {
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  /** How many cursor pages are currently loaded (for preserving pagination on refresh). */
  const loadedPageCountRef = useRef(1);
  /** Mirrors cursor/hasMore so serialized list ops read post-await state. */
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  /** Serializes refresh and load-more so neither collapses the other. */
  const listOpChainRef = useRef(Promise.resolve());

  const runListOp = useCallback(async (op: () => Promise<void>) => {
    const run = listOpChainRef.current.then(op, op);
    listOpChainRef.current = run.then(
      () => undefined,
      () => undefined
    );
    await run;
  }, []);

  const fetchListPage = useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
    if (cursor) params.set("cursor", cursor);

    return (await apiCall(
      `/payment-requests?${params.toString()}`
    )) as PaymentRequestListResponse;
  }, []);

  const applyPage = useCallback(
    (data: PaymentRequestListResponse, append: boolean) => {
      const page = data.payment_requests || [];
      const next = data.next_cursor ?? null;
      const more = Boolean(data.has_more);
      setRequests((prev) =>
        append ? mergeUniqueByPublicId(prev, page) : page
      );
      nextCursorRef.current = next;
      hasMoreRef.current = more;
      setNextCursor(next);
      setHasMore(more);
      setError("");
    },
    []
  );

  /**
   * Ordinary WS/Zap refresh: refetch every already-loaded cursor page so
   * pagination state is not collapsed back to page one.
   */
  const refresh = useCallback(async () => {
    await runListOp(async () => {
      try {
        const pagesToLoad = Math.max(1, loadedPageCountRef.current);
        let cursor: string | null = null;
        let merged: PaymentRequest[] = [];
        let next: string | null = null;
        let more = false;
        let pagesFetched = 0;

        for (let i = 0; i < pagesToLoad; i++) {
          const data = await fetchListPage(cursor);
          const page = data.payment_requests || [];
          merged = mergeUniqueByPublicId(merged, page);
          next = data.next_cursor ?? null;
          more = Boolean(data.has_more);
          pagesFetched = i + 1;
          if (!more || !next) break;
          cursor = next;
        }

        loadedPageCountRef.current = pagesFetched;
        nextCursorRef.current = next;
        hasMoreRef.current = more;
        setRequests((prev) => mergePaymentRequestListMonotonic(prev, merged));
        setNextCursor(next);
        setHasMore(more);
        setError("");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("Failed to load requests.");
        setError(message);
      }
    });
  }, [fetchListPage, runListOp, t]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        await runListOp(async () => {
          if (cancelled) return;
          const data = await fetchListPage(null);
          if (cancelled) return;
          loadedPageCountRef.current = 1;
          applyPage(data, false);
        });
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : t("Failed to load requests.");
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyPage, fetchListPage, runListOp, t]);

  useEffect(() => {
    registerRefresh(refresh);
    return () => registerRefresh(null);
  }, [registerRefresh, refresh]);

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await runListOp(async () => {
        const cursor = nextCursorRef.current;
        if (!cursor || !hasMoreRef.current) return;
        const data = await fetchListPage(cursor);
        applyPage(data, true);
        loadedPageCountRef.current += 1;
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("Failed to load requests.");
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const upsertRequest = (updated: PaymentRequest) => {
    setRequests((prev) => {
      const index = prev.findIndex((r) => r.public_id === updated.public_id);
      if (index === -1) return [updated, ...prev];
      const next = [...prev];
      next[index] = mergePaymentRequestMonotonic(prev[index], updated);
      return next;
    });
  };

  return (
    <section aria-labelledby="requests-heading">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h2
          id="requests-heading"
          className="text-xl sm:text-2xl font-semibold tracking-tight"
        >
          {t("Requests")}
        </h2>
        <div className="flex items-center gap-2">
          <IconButton
            label={balanceVisible ? t("Hide balance") : t("Show balance")}
            onClick={onToggleBalanceVisibility}
          >
            {balanceVisible ? (
              <Eye size={22} aria-hidden="true" />
            ) : (
              <EyeOff size={22} aria-hidden="true" />
            )}
          </IconButton>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-accent text-accent-fg font-semibold hover:bg-accent-hover transition touch-manipulation"
          >
            <Plus size={18} aria-hidden="true" />
            <span>{t("New Request")}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div
          className="py-16 text-center text-muted"
          role="status"
          aria-live="polite"
          aria-label={t("Loading requests")}
        >
          {t("Loading requests...")}
        </div>
      )}

      {!loading && error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {!loading && !error && requests.length === 0 && (
        <div
          className="py-16 text-center text-muted border border-dashed border-panel-edge rounded-xl"
          role="status"
        >
          <p className="mb-2">{t("No payment requests yet.")}</p>
          <p className="text-sm">
            {t("Create a request to share a Lightning invoice link.")}
          </p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <ul className="space-y-3" aria-label={t("Payment requests")}>
          {requests.map((request) => {
            const status = normalizePaymentRequestStatus(request.status);
            const amountLabel = balanceVisible
              ? `${formatSats(request.amount_sats, locale)} sats`
              : "•••••••";

            return (
              <li key={request.public_id}>
                <button
                  type="button"
                  onClick={() => setDetailId(request.public_id)}
                  className="w-full text-left min-h-11 p-4 rounded-xl border border-panel-edge bg-panel hover:bg-panel-elevated transition touch-manipulation focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={t("View request for {amount}", {
                    amount: amountLabel,
                  })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold font-amount tracking-tight">
                        {amountLabel}
                      </p>
                      {request.memo ? (
                        <p className="text-sm text-muted mt-1 truncate">
                          {request.memo}
                        </p>
                      ) : (
                        <p className="text-sm text-muted mt-1">
                          {t("No description")}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-2">
                        {formatRelativeDate(request.created_at, language)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center min-h-8 px-3 text-xs font-medium rounded-md border ${statusBadgeClass[status]}`}
                    >
                      {status === "unknown"
                        ? request.status
                        : t(statusLabelKey[status])}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-busy={loadingMore}
            className="min-h-11 px-6 rounded-lg border border-panel-edge bg-panel-elevated text-foreground font-semibold hover:bg-input disabled:opacity-50 transition touch-manipulation"
          >
            {loadingMore ? t("Loading...") : t("Load more")}
          </button>
        </div>
      )}

      {isCreateOpen && (
        <CreateRequestModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(created) => {
            upsertRequest(created);
            setIsCreateOpen(false);
            setDetailId(created.public_id);
          }}
        />
      )}

      {detailId && (
        <RequestDetailModal
          publicId={detailId}
          balanceVisible={balanceVisible}
          listRequest={
            requests.find((r) => r.public_id === detailId) ?? null
          }
          onClose={() => setDetailId(null)}
          onUpdated={upsertRequest}
        />
      )}
    </section>
  );
};
