"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall, PaymentRequest, PaymentRequestListResponse } from "../../lib/api";
import {
  getActivePaymentRequestPollIntervalMs,
  getEffectivePaymentRequestStatus,
  getMsUntilPaymentRequestLocalExpiry,
  getNextPaymentRequestBackoffMs,
  PAYMENT_REQUEST_MAX_TIMER_MS,
  isActiveReconcilableStatus,
  isFinalPaymentRequestStatus,
  isTerminalReconcilableStatus,
  mergePaymentRequestListMonotonic,
  mergePaymentRequestMonotonic,
  needsPaymentRequestReconciliation,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS,
  paymentRequestStatusLabelKey,
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
  /** Forces re-render when local expiry crosses without a network update. */
  const [, setExpiryTick] = useState(0);
  /** How many cursor pages are currently loaded (for preserving pagination on refresh). */
  const loadedPageCountRef = useRef(1);
  /** Mirrors cursor/hasMore so serialized list ops read post-await state. */
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  /** Serializes refresh and load-more so neither collapses the other. */
  const listOpChainRef = useRef(Promise.resolve());
  const requestsRef = useRef<PaymentRequest[]>([]);
  requestsRef.current = requests;
  /** Elapsed visible polling time for active backoff curve. */
  const pollStartedAtRef = useRef<number | null>(null);
  /** First time each public_id was observed in a terminal-reconcilable state. */
  const terminalSeenAtRef = useRef<Map<string, number>>(new Map());
  const backoffMsRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleExpiryTickRef = useRef<(() => void) | null>(null);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

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
        backoffMsRef.current = null;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("Failed to load requests.");
        setError(message);
        backoffMsRef.current = getNextPaymentRequestBackoffMs(
          backoffMsRef.current
        );
      }
    });
  }, [fetchListPage, runListOp, t]);

  refreshRef.current = refresh;

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
          backoffMsRef.current = null;
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

  // Track when terminal-reconcilable statuses are first observed.
  useEffect(() => {
    const now = Date.now();
    const seen = terminalSeenAtRef.current;
    const activeIds = new Set<string>();
    for (const request of requests) {
      const effective = getEffectivePaymentRequestStatus(request, now);
      if (isTerminalReconcilableStatus(effective)) {
        activeIds.add(request.public_id);
        if (!seen.has(request.public_id)) {
          seen.set(request.public_id, now);
        }
      } else if (isFinalPaymentRequestStatus(effective)) {
        seen.delete(request.public_id);
      } else if (isActiveReconcilableStatus(effective)) {
        seen.delete(request.public_id);
      }
    }
    for (const id of [...seen.keys()]) {
      if (!activeIds.has(id) && !requests.some((r) => r.public_id === id)) {
        seen.delete(id);
      }
    }
  }, [requests]);

  // Autonomous serialized polling + visibility pause/resume + local expiry ticks.
  // Depends only on `loading` so list refreshes (which replace `requests`) do not
  // remount and immediately schedulePoll(0) in a tight loop. requestsRef is live.
  useEffect(() => {
    if (loading) return;

    let cancelled = false;

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

    const listNeedsPoll = (now: number): {
      needed: boolean;
      useTerminalInterval: boolean;
    } => {
      let needed = false;
      let anyActive = false;
      let anyTerminalInWindow = false;
      for (const request of requestsRef.current) {
        if (!needsPaymentRequestReconciliation(request, now)) continue;
        const effective = getEffectivePaymentRequestStatus(request, now);
        if (isActiveReconcilableStatus(effective)) {
          needed = true;
          anyActive = true;
          continue;
        }
        if (isTerminalReconcilableStatus(effective)) {
          const seenAt = terminalSeenAtRef.current.get(request.public_id) ?? now;
          if (now - seenAt <= PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS) {
            needed = true;
            anyTerminalInWindow = true;
          }
        }
      }
      return {
        needed,
        useTerminalInterval: !anyActive && anyTerminalInWindow,
      };
    };

    const scheduleExpiryTick = () => {
      clearExpiryTimer();
      if (cancelled) return;
      const now = Date.now();
      let soonest: number | null = null;
      for (const request of requestsRef.current) {
        const ms = getMsUntilPaymentRequestLocalExpiry(request, now);
        if (ms === null || ms <= 0) continue;
        if (soonest === null || ms < soonest) soonest = ms;
      }
      if (soonest === null || soonest <= 0) return;
      expiryTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setExpiryTick((n) => n + 1);
        scheduleExpiryTick();
        schedulePoll(0);
      }, Math.min(soonest, PAYMENT_REQUEST_MAX_TIMER_MS));
    };
    scheduleExpiryTickRef.current = scheduleExpiryTick;

    const schedulePoll = (delayMs: number) => {
      clearPollTimer();
      if (cancelled || isDocumentHidden()) return;
      const { needed } = listNeedsPoll(Date.now());
      if (!needed && backoffMsRef.current === null) return;
      pollTimerRef.current = setTimeout(() => {
        void runPoll();
      }, Math.max(0, delayMs));
    };

    const runPoll = async () => {
      if (cancelled || isDocumentHidden()) return;
      const now = Date.now();
      const { needed } = listNeedsPoll(now);
      if (!needed && backoffMsRef.current === null) return;

      if (pollStartedAtRef.current === null) {
        pollStartedAtRef.current = now;
      }

      await refreshRef.current?.();
      if (cancelled || isDocumentHidden()) return;

      const after = Date.now();
      const next = listNeedsPoll(after);
      if (!next.needed && backoffMsRef.current === null) {
        pollStartedAtRef.current = null;
        clearPollTimer();
        scheduleExpiryTick();
        return;
      }

      if (backoffMsRef.current !== null) {
        schedulePoll(backoffMsRef.current);
        scheduleExpiryTick();
        return;
      }

      if (next.useTerminalInterval) {
        schedulePoll(PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS);
      } else {
        const elapsed = after - (pollStartedAtRef.current ?? after);
        schedulePoll(getActivePaymentRequestPollIntervalMs(elapsed));
      }
      scheduleExpiryTick();
    };

    const onVisibilityOrFocus = () => {
      if (cancelled) return;
      if (isDocumentHidden()) {
        clearPollTimer();
        return;
      }
      // Immediate resume/refresh when becoming visible or focused.
      schedulePoll(0);
    };

    scheduleExpiryTick();
    // First autonomous tick uses the normal active interval (not 0) so mount
    // does not race an in-flight manual refresh/load-more.
    schedulePoll(getActivePaymentRequestPollIntervalMs(0));

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      clearPollTimer();
      clearExpiryTimer();
      scheduleExpiryTickRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [loading]);

  // Reschedule local-expiry timer when the list changes without remounting polls.
  useEffect(() => {
    if (loading) return;
    scheduleExpiryTickRef.current?.();
  }, [requests, loading]);

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
            const status = getEffectivePaymentRequestStatus(request);
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
                        : t(paymentRequestStatusLabelKey[status])}
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
