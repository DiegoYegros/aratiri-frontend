import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clearPaymentRequestInvoiceIfNotOpen,
  createIdempotencyKey,
  getActivePaymentRequestPollIntervalMs,
  getEffectivePaymentRequestStatus,
  getMsUntilPaymentRequestLocalExpiry,
  getNextPaymentRequestBackoffMs,
  getPaymentRequestShareUrl,
  isActiveReconcilableStatus,
  isCancellablePaymentRequest,
  isFinalPaymentRequestStatus,
  isOpenAndNotLocallyExpired,
  isPayablePaymentRequest,
  isTerminalPaymentRequestStatus,
  isTerminalReconcilableStatus,
  isValidAmountSats,
  MAX_MEMO_LENGTH,
  mergePaymentRequestListMonotonic,
  mergePaymentRequestMonotonic,
  normalizePaymentRequestStatus,
  PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS,
  PAYMENT_REQUEST_BACKOFF_INITIAL_MS,
  PAYMENT_REQUEST_BACKOFF_MAX_MS,
  PAYMENT_REQUEST_POLL_INTERVAL_MS,
  PAYMENT_REQUEST_VISIBLE_POLL_MAX_MS,
  shouldAcceptPaymentRequestStatusUpdate,
} from "@/app/lib/paymentRequests";
import { fetchPublicPaymentRequest, getBackendRootUrl } from "@/app/lib/api";
import type { PaymentRequest } from "@/app/lib/api";

const sample = (overrides: Partial<PaymentRequest> = {}): PaymentRequest => ({
  public_id: "req-1",
  share_url: "https://api.example/r/req-1",
  amount_sats: 100,
  memo: null,
  status: "OPEN",
  payment_request: "lnbc",
  created_at: "2026-01-01T00:00:00Z",
  expires_at: "2099-01-01T00:00:00Z",
  paid_at: null,
  cancelled_at: null,
  ...overrides,
});

describe("paymentRequests helpers", () => {
  it("normalizes statuses defensively including exact backend casing", () => {
    expect(normalizePaymentRequestStatus("OPEN")).toBe("open");
    expect(normalizePaymentRequestStatus("PENDING")).toBe("open");
    expect(normalizePaymentRequestStatus("pending")).toBe("open");
    expect(normalizePaymentRequestStatus("PROVISIONING")).toBe("provisioning");
    expect(normalizePaymentRequestStatus("CANCEL_PENDING")).toBe(
      "cancel_pending"
    );
    expect(normalizePaymentRequestStatus("cancel-pending")).toBe(
      "cancel_pending"
    );
    expect(normalizePaymentRequestStatus("PAID")).toBe("paid");
    expect(normalizePaymentRequestStatus("EXPIRED")).toBe("expired");
    expect(normalizePaymentRequestStatus("FAILED")).toBe("failed");
    expect(normalizePaymentRequestStatus("CANCELLED")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("CANCELED")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("canceled")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("weird")).toBe("unknown");
  });

  it("applies local expiry only to OPEN without mutating raw status helpers", () => {
    const now = Date.parse("2026-06-01T00:00:00Z");
    const openFuture = sample({
      status: "OPEN",
      expires_at: "2099-01-01T00:00:00Z",
    });
    const openPast = sample({
      status: "OPEN",
      expires_at: "2020-01-01T00:00:00Z",
    });
    const paidPast = sample({
      status: "PAID",
      expires_at: "2020-01-01T00:00:00Z",
      payment_request: null,
    });

    expect(getEffectivePaymentRequestStatus(openFuture, now)).toBe("open");
    expect(getEffectivePaymentRequestStatus(openPast, now)).toBe("expired");
    expect(getEffectivePaymentRequestStatus(paidPast, now)).toBe("paid");
    expect(isOpenAndNotLocallyExpired(openFuture, now)).toBe(true);
    expect(isOpenAndNotLocallyExpired(openPast, now)).toBe(false);
    expect(getMsUntilPaymentRequestLocalExpiry(openFuture, now)).toBeGreaterThan(
      0
    );
    expect(getMsUntilPaymentRequestLocalExpiry(openPast, now)).toBeNull();
    expect(
      getMsUntilPaymentRequestLocalExpiry(
        sample({ status: "CANCELLED", expires_at: "2099-01-01T00:00:00Z" }),
        now
      )
    ).toBeNull();
  });

  it("treats only OPEN (not locally expired) as payable and cancellable", () => {
    const now = Date.parse("2026-06-01T00:00:00Z");
    expect(
      isPayablePaymentRequest(
        sample({ status: "OPEN", payment_request: "lnbc" }),
        now
      )
    ).toBe(true);
    expect(
      isPayablePaymentRequest(
        sample({ status: "pending", payment_request: "lnbc" }),
        now
      )
    ).toBe(true);
    expect(
      isPayablePaymentRequest(
        sample({ status: "OPEN", payment_request: null }),
        now
      )
    ).toBe(false);
    expect(
      isPayablePaymentRequest(
        sample({
          status: "OPEN",
          expires_at: "2020-01-01T00:00:00Z",
          payment_request: "lnbc",
        }),
        now
      )
    ).toBe(false);
    expect(
      isPayablePaymentRequest(
        sample({ status: "PROVISIONING", payment_request: "lnbc" }),
        now
      )
    ).toBe(false);
    expect(
      isPayablePaymentRequest(
        sample({ status: "CANCEL_PENDING", payment_request: "lnbc" }),
        now
      )
    ).toBe(false);
    expect(
      isPayablePaymentRequest(
        sample({ status: "FAILED", payment_request: "lnbc" }),
        now
      )
    ).toBe(false);

    expect(isCancellablePaymentRequest(sample({ status: "OPEN" }), now)).toBe(
      true
    );
    expect(
      isCancellablePaymentRequest(sample({ status: "pending" }), now)
    ).toBe(true);
    expect(
      isCancellablePaymentRequest(
        sample({ status: "OPEN", expires_at: "2020-01-01T00:00:00Z" }),
        now
      )
    ).toBe(false);
    expect(isCancellablePaymentRequest(sample({ status: "PAID" }), now)).toBe(
      false
    );
    expect(
      isCancellablePaymentRequest(sample({ status: "PROVISIONING" }), now)
    ).toBe(false);
    expect(
      isCancellablePaymentRequest(sample({ status: "CANCEL_PENDING" }), now)
    ).toBe(false);
  });

  it("clears bolt11 for every non-OPEN normalized status", () => {
    expect(
      clearPaymentRequestInvoiceIfNotOpen(
        sample({ status: "OPEN", payment_request: "lnbc" })
      ).payment_request
    ).toBe("lnbc");
    expect(
      clearPaymentRequestInvoiceIfNotOpen(
        sample({ status: "PAID", payment_request: "lnbc" })
      ).payment_request
    ).toBeNull();
    expect(
      clearPaymentRequestInvoiceIfNotOpen(
        sample({ status: "CANCELLED", payment_request: "lnbc" })
      ).payment_request
    ).toBeNull();
    expect(
      clearPaymentRequestInvoiceIfNotOpen(
        sample({ status: "PROVISIONING", payment_request: "lnbc" })
      ).payment_request
    ).toBeNull();
    expect(
      clearPaymentRequestInvoiceIfNotOpen(
        sample({ status: "FAILED", payment_request: "lnbc" })
      ).payment_request
    ).toBeNull();
  });

  it("applies monotonic status precedence with PAID authoritative", () => {
    expect(isTerminalPaymentRequestStatus("paid")).toBe(true);
    expect(isTerminalPaymentRequestStatus("cancelled")).toBe(true);
    expect(isTerminalPaymentRequestStatus("expired")).toBe(true);
    expect(isTerminalPaymentRequestStatus("failed")).toBe(true);
    expect(isTerminalPaymentRequestStatus("open")).toBe(false);
    expect(isFinalPaymentRequestStatus("paid")).toBe(true);
    expect(isFinalPaymentRequestStatus("cancelled")).toBe(false);
    expect(isActiveReconcilableStatus("open")).toBe(true);
    expect(isActiveReconcilableStatus("provisioning")).toBe(true);
    expect(isActiveReconcilableStatus("cancel_pending")).toBe(true);
    expect(isTerminalReconcilableStatus("cancelled")).toBe(true);
    expect(isTerminalReconcilableStatus("expired")).toBe(true);
    expect(isTerminalReconcilableStatus("failed")).toBe(true);
    expect(isTerminalReconcilableStatus("paid")).toBe(false);

    expect(shouldAcceptPaymentRequestStatusUpdate("CANCELLED", "OPEN")).toBe(
      false
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("PAID", "OPEN")).toBe(false);
    expect(shouldAcceptPaymentRequestStatusUpdate("EXPIRED", "pending")).toBe(
      false
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("paid", "CANCELLED")).toBe(
      false
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("FAILED", "OPEN")).toBe(
      false
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("CANCELLED", "PAID")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("EXPIRED", "PAID")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("FAILED", "PAID")).toBe(true);
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "PAID")).toBe(true);
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "CANCELLED")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "OPEN")).toBe(true);
    expect(shouldAcceptPaymentRequestStatusUpdate("PAID", "paid")).toBe(true);
    expect(
      shouldAcceptPaymentRequestStatusUpdate("CANCEL_PENDING", "OPEN")
    ).toBe(false);
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "PROVISIONING")).toBe(
      false
    );
    expect(
      shouldAcceptPaymentRequestStatusUpdate("PROVISIONING", "OPEN")
    ).toBe(true);
  });

  it("merges payment requests without regressing PAID or clearing wrong invoices", () => {
    const cancelled = sample({
      status: "CANCELLED",
      cancelled_at: "2026-01-02T00:00:00Z",
      payment_request: null,
    });
    const staleOpen = sample({ status: "OPEN", memo: "stale" });
    expect(mergePaymentRequestMonotonic(cancelled, staleOpen)).toBe(cancelled);

    const paid = sample({
      status: "PAID",
      paid_at: "2026-01-03T00:00:00Z",
      payment_request: null,
    });
    expect(mergePaymentRequestMonotonic(cancelled, paid)).toEqual(paid);
    expect(mergePaymentRequestMonotonic(paid, staleOpen)).toBe(paid);
    expect(
      mergePaymentRequestMonotonic(
        paid,
        sample({ status: "OPEN", payment_request: "lnbc-stale" })
      )
    ).toBe(paid);

    const expired = sample({ status: "EXPIRED", payment_request: null });
    expect(mergePaymentRequestMonotonic(expired, paid)).toEqual(paid);

    const list = mergePaymentRequestListMonotonic(
      [cancelled, sample({ public_id: "req-2", status: "OPEN" })],
      [
        sample({ public_id: "req-1", status: "OPEN", memo: "stale refresh" }),
        sample({
          public_id: "req-2",
          status: "PAID",
          paid_at: "2026-01-03T00:00:00Z",
        }),
        sample({ public_id: "req-3", status: "OPEN", memo: "new" }),
      ]
    );
    expect(list[0]).toEqual(cancelled);
    expect(list[1].status).toBe("PAID");
    expect(list[2].memo).toBe("new");
  });

  it("computes active poll interval backoff and transient backoff helpers", () => {
    expect(getActivePaymentRequestPollIntervalMs(0)).toBe(
      PAYMENT_REQUEST_POLL_INTERVAL_MS
    );
    expect(
      getActivePaymentRequestPollIntervalMs(
        PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS - 1
      )
    ).toBe(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    expect(
      getActivePaymentRequestPollIntervalMs(
        PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS
      )
    ).toBeGreaterThanOrEqual(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    expect(
      getActivePaymentRequestPollIntervalMs(
        PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS +
          PAYMENT_REQUEST_POLL_INTERVAL_MS * 20
      )
    ).toBe(PAYMENT_REQUEST_VISIBLE_POLL_MAX_MS);

    expect(getNextPaymentRequestBackoffMs(null)).toBe(
      PAYMENT_REQUEST_BACKOFF_INITIAL_MS
    );
    expect(getNextPaymentRequestBackoffMs(0)).toBe(
      PAYMENT_REQUEST_BACKOFF_INITIAL_MS
    );
    expect(
      getNextPaymentRequestBackoffMs(PAYMENT_REQUEST_BACKOFF_INITIAL_MS)
    ).toBe(PAYMENT_REQUEST_BACKOFF_INITIAL_MS * 2);
    expect(getNextPaymentRequestBackoffMs(PAYMENT_REQUEST_BACKOFF_MAX_MS)).toBe(
      PAYMENT_REQUEST_BACKOFF_MAX_MS
    );
  });

  it("validates positive integer sats amounts", () => {
    expect(isValidAmountSats("100")).toBe(true);
    expect(isValidAmountSats("0")).toBe(false);
    expect(isValidAmountSats("-1")).toBe(false);
    expect(isValidAmountSats("1.5")).toBe(false);
    expect(isValidAmountSats("abc")).toBe(false);
  });

  it("builds frontend-origin share URLs with backend fallback", () => {
    expect(
      getPaymentRequestShareUrl("abc", "https://api.example/r/abc")
    ).toMatch(/\/pay\/abc$/);

    const originalOrigin = window.location.origin;
    expect(getPaymentRequestShareUrl("xyz", "https://fallback/r/xyz")).toBe(
      `${originalOrigin}/pay/xyz`
    );
  });

  it("creates UUID-like idempotency keys", () => {
    const key = createIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("exposes the backend memo maximum", () => {
    expect(MAX_MEMO_LENGTH).toBe(500);
  });
});

describe("getBackendRootUrl", () => {
  it("strips only a trailing /v1", () => {
    expect(getBackendRootUrl("https://example.test/v1")).toBe(
      "https://example.test"
    );
    expect(getBackendRootUrl("https://example.test/v1/")).toBe(
      "https://example.test"
    );
    expect(getBackendRootUrl("https://example.test/api/v1")).toBe(
      "https://example.test/api"
    );
  });
});

describe("fetchPublicPaymentRequest", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches backend-root /r/{publicId} without Authorization", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          public_id: "pub-1",
          share_url: "https://api.example/r/pub-1",
          amount_sats: 100,
          memo: null,
          status: "OPEN",
          payment_request: "lnbc",
          created_at: "2026-07-01T12:00:00Z",
          expires_at: null,
          paid_at: null,
          cancelled_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await fetchPublicPaymentRequest("pub-1");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toBe(`${getBackendRootUrl()}/r/pub-1`);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(init?.headers).toBeUndefined();
  });
});
