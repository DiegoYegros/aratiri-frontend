import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicPayPage } from "@/app/pay/[publicId]/PublicPayPage";
import { LanguageProvider } from "@/app/LanguageProvider";
import type { PaymentRequest } from "@/app/lib/api";
import { PAYMENT_REQUEST_POLL_INTERVAL_MS } from "@/app/lib/paymentRequests";

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
  status: "pending",
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

  it("renders pending payment with local QR and open-wallet action", async () => {
    fetchPublicPaymentRequest.mockResolvedValue(sample());
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
    expect(screen.getByRole("link", { name: "Open in Wallet" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(await screen.findAllByText("Link copied")).not.toHaveLength(0);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/pay/pub-1`
    );
  });

  it("shows paid, expired, cancelled, and not-found states", async () => {
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

    const notFound = Object.assign(new Error("Not found"), { status: 404 });
    fetchPublicPaymentRequest.mockRejectedValue(notFound);
    rerender(
      <LanguageProvider>
        <PublicPayPage publicId="missing" />
      </LanguageProvider>
    );
    expect(
      await screen.findByText("Payment request not found.")
    ).toBeInTheDocument();
  });

  it("shows a loading state then an error state", async () => {
    fetchPublicPaymentRequest.mockRejectedValue(new Error("Network down"));

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(screen.getByLabelText("Loading payment")).toBeInTheDocument();
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("1,500 sats")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(await screen.findAllByText("Link copied")).not.toHaveLength(0);
  });

  it("stops and shows not-found on refresh 404 without leaving request payable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPublicPaymentRequest
      .mockResolvedValueOnce(sample({ status: "OPEN" }))
      .mockRejectedValueOnce(
        Object.assign(new Error("Not found"), { status: 404 })
      );

    render(
      <LanguageProvider>
        <PublicPayPage publicId="pub-1" />
      </LanguageProvider>
    );

    expect(await screen.findByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Wallet" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });

    expect(
      await screen.findByText("Payment request not found.")
    ).toBeInTheDocument();
    expect(screen.queryByText("1,500 sats")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Wallet" })
    ).not.toBeInTheDocument();

    const callsAfter404 = fetchPublicPaymentRequest.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(fetchPublicPaymentRequest.mock.calls.length).toBe(callsAfter404);
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
    expect(screen.getByRole("link", { name: "Open in Wallet" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() =>
      expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(2)
    );
    // Still payable after transient failure.
    expect(screen.getByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Wallet" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() =>
      expect(fetchPublicPaymentRequest).toHaveBeenCalledTimes(3)
    );
    expect(screen.getByText("1,500 sats")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Wallet" })).toBeInTheDocument();
  });
});
