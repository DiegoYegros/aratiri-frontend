import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicPayPage } from "@/app/pay/[publicId]/PublicPayPage";
import { LanguageProvider } from "@/app/LanguageProvider";
import type { PaymentRequest } from "@/app/lib/api";
import {
  PAYMENT_REQUEST_BACKOFF_INITIAL_MS,
  PAYMENT_REQUEST_POLL_INTERVAL_MS,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS,
  PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS,
  PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT,
} from "@/app/lib/paymentRequests";

const fetchPublicPaymentRequest = vi.fn();

vi.mock("@/app/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api")>(
    "@/app/lib/api"
  );
  return {
    ...actual,
    fetchPublicPaymentRequest: (...args: unknown[]) =>
      fetchPublicPaymentRequest(...args),
  };
});

vi.mock("@/app/components/ui/LocalQrCode", () => ({
  LocalQrCode: ({ value, alt }: { value: string; alt: string }) => (
    <img data-testid="local-qr" alt={alt} data-value={value} src="data:qr" />
  ),
}));

const sample = (overrides: Partial<PaymentRequest> = {}): PaymentRequest => ({
  public_id: "pub-1",
  share_url: "https://api.example/r/pub-1",
  amount_sats: 1500,
  memo: "Lunch",
  status: "OPEN",
  payment_request: "lnbc1500n1test",
  created_at: "2026-07-01T12:00:00Z",
  expires_at: "2099-07-02T12:00:00Z",
  paid_at: null,
  cancelled_at: null,
  ...overrides,
});

const writeText = vi.fn().mockResolvedValue(undefined);

describe("PublicPayPage", () => {
  beforeEach(() => {
    fetchPublicPaymentRequest.mockReset();
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Reflect.deleteProperty(navigator, "share");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders OPEN payment with local QR and open-wallet action", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "OPEN" }));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    const qr = screen.getByTestId("local-qr");
    expect(qr).toHaveAttribute("data-value", "lnbc1500n1test");
    expect(qr.getAttribute("src")).not.toContain("qrserver");

    const openWallet = screen.getByRole("link", { name: "Open in Wallet" });
    expect(openWallet).toHaveAttribute("href", "lightning:lnbc1500n1test");

    expect(
      screen.getByText(`${window.location.origin}/pay/pub-1`)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(await screen.findAllByText("Link copied")).not.toHaveLength(0);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/pay/pub-1`
    );
  });

  it("renders pending alias as OPEN payable payment", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(
      sample({ status: "pending" })
    );
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(await screen.findAllByText("Link copied")).not.toHaveLength(0);
  });

  it("shows paid, expired, and cancelled states", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "PAID" }));
    const { rerender } = render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This request has been paid.")
    ).toBeInTheDocument();

    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "EXPIRED" }));
    rerender(
      <LanguageProvider>
        <PublicPayPage publicId="pub-2" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This payment request has expired.")
    ).toBeInTheDocument();

    fetchPublicPaymentRequest.mockResolvedValue(
      sample({ status: "CANCELLED" })
    );
    rerender(
      <LanguageProvider>
        <PublicPayPage publicId="pub-3" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This payment request was cancelled.")
    ).toBeInTheDocument();
  });

  it("retries initial 404 then shows OPEN", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404 })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404 })
      )
      .mockResolvedValueOnce(sample({ status: "OPEN" }));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(screen.getByLabelText("Loading payment")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS);
    });

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByTestId("local-qr")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(3);
  });

  it("exhausts initial 404 budget then shows not-found with Retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest.mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 })
    );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="missing" />
      </LanguageProvider>
    );

    for (let i = 1; i < PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS
        );
      });
    }

    expect(
      await screen.findByText("Payment request not found.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(
      PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT
    );
  });

  it("exhausts initial transient errors then shows error with Retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest.mockRejectedValue(new Error("Network down"));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(screen.getByLabelText("Loading payment")).toBeInTheDocument();

    for (let i = 1; i < PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_BACKOFF_INITIAL_MS * i);
      });
    }

    expect(
      await screen.findByText("Failed to load payment.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
    expect(screen.queryByText("1,500 sats")).not.toBeInTheDocument();
  });

  it("explicit Retry restarts the 404 budget after exhaustion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest.mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LanguageProvider>
        <PublicPayPage publicId="missing" />
      </LanguageProvider>
    );

    for (let i = 1; i < PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS
        );
      });
    }
    expect(
      await screen.findByText("Payment request not found.")
    ).toBeInTheDocument();
    const callsAfterExhaust = fetchPublicPaymentRequest.mock.calls.length;

    fetchPublicPaymentRequest.mockReset();
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "OPEN" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);
    expect(callsAfterExhaust).toBe(PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT);
  });

  it("polls OPEN requests, transitions to PAID without loading flicker, and stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockResolvedValueOnce(
        sample({
          status: "PAID",
          paid_at: "2026-07-01T12:05:00Z",
          payment_request: null,
        })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByTestId("local-qr")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });

    expect(
      await screen.findByText("This request has been paid.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading payment")).not.toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(2);

    const callsAfterPaid = fetchPublicPaymentRequest.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(fetchPublicPaymentRequest.mock.calls.length).toBe(callsAfterPaid);
  });

  it("retries known OPEN → 404 within budget then recovers to PAID", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404 })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404 })
      )
      .mockResolvedValueOnce(
        sample({
          status: "PAID",
          paid_at: "2026-07-01T12:05:00Z",
          payment_request: null,
        })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    // Still payable during 404 recovery.
    expect(screen.getByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS);
    });

    expect(
      await screen.findByText("This request has been paid.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();
  });

  it("exhausts known-OPEN refresh 404 then shows not-found without leaving payable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockRejectedValue(
        Object.assign(new Error("Not found"), { status: 404 })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    for (let i = 1; i < PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS
        );
      });
    }

    expect(
      await screen.findByText("Payment request not found.")
    ).toBeInTheDocument();
    expect(screen.queryByText("1,500 sats")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  });

  it("stops and shows unavailable on refresh 410", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { status: 410 }));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });

    expect(
      await screen.findByText("This payment request is unavailable.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();

    const callsAfter410 = fetchPublicPaymentRequest.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(fetchPublicPaymentRequest.mock.calls.length).toBe(callsAfter410);
  });

  it("retries transient refresh failures (5xx) while keeping last payable state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockRejectedValueOnce(
        Object.assign(new Error("Service unavailable"), { status: 503 })
      )
      .mockResolvedValueOnce(sample({ status: "OPEN" }));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() =>
      expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(2)
    );
    expect(screen.getByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_BACKOFF_INITIAL_MS);
    });
    await waitFor(() =>
      expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(3)
    );
    expect(screen.getByText("1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();
  });

  it("local expiry immediately removes QR/copy/open-wallet during network failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    const expiresAt = new Date(Date.now() + 2_000).toISOString();
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(
        sample({ status: "OPEN", expires_at: expiresAt })
      )
      .mockRejectedValue(
        Object.assign(new Error("Service unavailable"), { status: 503 })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByTestId("local-qr")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in Wallet" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });

    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy invoice" })
    ).not.toBeInTheDocument();
  });

  it("shows safe non-payable states for PROVISIONING, CANCEL_PENDING, and FAILED", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(
      sample({ status: "PROVISIONING", payment_request: null })
    );
    const { rerender } = render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This payment request is being prepared.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preparing")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();

    fetchPublicPaymentRequest.mockResolvedValue(
      sample({ status: "CANCEL_PENDING", payment_request: null })
    );
    rerender(
      <LanguageProvider>
        <PublicPayPage publicId="pub-2" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This payment request is being cancelled.")
    ).toBeInTheDocument();
    expect(screen.getByText("Cancelling")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();

    fetchPublicPaymentRequest.mockResolvedValue(
      sample({ status: "FAILED", payment_request: null })
    );
    rerender(
      <LanguageProvider>
        <PublicPayPage publicId="pub-3" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("This payment request failed.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
  });

  it("bounded reconciles CANCELLED → PAID then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(
        sample({
          status: "CANCELLED",
          cancelled_at: "2026-07-01T12:01:00Z",
          payment_request: null,
        })
      )
      .mockResolvedValueOnce(
        sample({
          status: "PAID",
          paid_at: "2026-07-01T12:05:00Z",
          cancelled_at: "2026-07-01T12:01:00Z",
          payment_request: null,
        })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(
      await screen.findByText("This payment request was cancelled.")
    ).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS
      );
    });

    expect(
      await screen.findByText("This request has been paid.")
    ).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(2);

    const afterPaid = fetchPublicPaymentRequest.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS * 2
      );
    });
    expect(fetchPublicPaymentRequest.mock.calls.length).toBe(afterPaid);
  });

  it("does not overlap in-flight polls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let inFlight = 0;
    let overlaps = 0;
    let hits = 0;
    let resolveSecond: ((value: PaymentRequest) => void) | undefined;

    fetchPublicPaymentRequest.mockImplementation(async () => {
      hits += 1;
      if (inFlight > 0) overlaps += 1;
      inFlight += 1;
      try {
        if (hits === 1) return sample({ status: "OPEN" });
        if (hits === 2) {
          return new Promise<PaymentRequest>((resolve) => {
            resolveSecond = resolve;
          });
        }
        return sample({ status: "OPEN" });
      } finally {
        inFlight -= 1;
      }
    });

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(hits).toBe(2));
    expect(resolveSecond).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    expect(hits).toBe(2);

    await act(async () => {
      resolveSecond?.(sample({ status: "OPEN" }));
    });
    expect(overlaps).toBe(0);
  });

  it("resumes polling on focus after visibility pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "OPEN" }));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() =>
      expect(fetchPublicPaymentRequest.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it("stops polling on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "OPEN" }));

    const { unmount } = render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByTestId("local-qr")).toBeInTheDocument();
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(1);
  });

  it("shares the frontend pay URL and ignores user-cancelled share", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(sample({ status: "OPEN" }));
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("Share canceled", "AbortError"));
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({
      title: "Payment Request",
      text: "Pay this Lightning request",
      url: `${window.location.origin}/pay/pub-1`,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
