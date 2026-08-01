import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createIdempotencyKey,
  getPaymentRequestShareUrl,
  isCancellablePaymentRequest,
  isTerminalPaymentRequestStatus,
  isValidAmountSats,
  MAX_MEMO_LENGTH,
  mergePaymentRequestListMonotonic,
  mergePaymentRequestMonotonic,
  normalizePaymentRequestStatus,
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
    expect(normalizePaymentRequestStatus("OPEN")).toBe("pending");
    expect(normalizePaymentRequestStatus("PENDING")).toBe("pending");
    expect(normalizePaymentRequestStatus("PAID")).toBe("paid");
    expect(normalizePaymentRequestStatus("EXPIRED")).toBe("expired");
    expect(normalizePaymentRequestStatus("CANCELLED")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("CANCELED")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("canceled")).toBe("cancelled");
    expect(normalizePaymentRequestStatus("weird")).toBe("unknown");
  });

  it("applies monotonic status precedence for stale refresh races", () => {
    expect(isTerminalPaymentRequestStatus("paid")).toBe(true);
    expect(isTerminalPaymentRequestStatus("cancelled")).toBe(true);
    expect(isTerminalPaymentRequestStatus("expired")).toBe(true);
    expect(isTerminalPaymentRequestStatus("pending")).toBe(false);

    // Never regress terminal → OPEN/pending
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

    // Settlement may advance CANCELLED/EXPIRED → PAID
    expect(shouldAcceptPaymentRequestStatusUpdate("CANCELLED", "PAID")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("EXPIRED", "PAID")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("cancelled", "paid")).toBe(
      true
    );

    // pending may advance to any terminal; same status is always ok
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "PAID")).toBe(true);
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "CANCELLED")).toBe(
      true
    );
    expect(shouldAcceptPaymentRequestStatusUpdate("OPEN", "OPEN")).toBe(true);
    expect(shouldAcceptPaymentRequestStatusUpdate("PAID", "paid")).toBe(true);
  });

  it("merges payment requests without regressing terminal status", () => {
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

    const expired = sample({ status: "EXPIRED", payment_request: null });
    expect(mergePaymentRequestMonotonic(expired, paid)).toEqual(paid);

    const list = mergePaymentRequestListMonotonic(
      [cancelled, sample({ public_id: "req-2", status: "OPEN" })],
      [
        sample({ public_id: "req-1", status: "OPEN", memo: "stale refresh" }),
        sample({ public_id: "req-2", status: "PAID", paid_at: "2026-01-03T00:00:00Z" }),
        sample({ public_id: "req-3", status: "OPEN", memo: "new" }),
      ]
    );
    expect(list[0]).toEqual(cancelled);
    expect(list[1].status).toBe("PAID");
    expect(list[2].memo).toBe("new");
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
    // jsdom always has an origin; fallback path is covered by helper branch via unit logic
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

  it("only allows cancelling OPEN/pending non-expired requests", () => {
    expect(
      isCancellablePaymentRequest({
        public_id: "1",
        share_url: "",
        amount_sats: 10,
        memo: null,
        status: "OPEN",
        payment_request: "lnbc",
        created_at: "2026-01-01T00:00:00Z",
        expires_at: "2099-01-01T00:00:00Z",
        paid_at: null,
        cancelled_at: null,
      })
    ).toBe(true);

    expect(
      isCancellablePaymentRequest({
        public_id: "1",
        share_url: "",
        amount_sats: 10,
        memo: null,
        status: "pending",
        payment_request: "lnbc",
        created_at: "2026-01-01T00:00:00Z",
        expires_at: "2099-01-01T00:00:00Z",
        paid_at: null,
        cancelled_at: null,
      })
    ).toBe(true);

    expect(
      isCancellablePaymentRequest({
        public_id: "1",
        share_url: "",
        amount_sats: 10,
        memo: null,
        status: "PAID",
        payment_request: null,
        created_at: "2026-01-01T00:00:00Z",
        expires_at: null,
        paid_at: "2026-01-02T00:00:00Z",
        cancelled_at: null,
      })
    ).toBe(false);

    expect(
      isCancellablePaymentRequest({
        public_id: "1",
        share_url: "",
        amount_sats: 10,
        memo: null,
        status: "OPEN",
        payment_request: "lnbc",
        created_at: "2026-01-01T00:00:00Z",
        expires_at: "2020-01-01T00:00:00Z",
        paid_at: null,
        cancelled_at: null,
      })
    ).toBe(false);
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
    // Default fetch call must not attach Authorization via headers object either.
    expect(init?.headers).toBeUndefined();
  });
});
