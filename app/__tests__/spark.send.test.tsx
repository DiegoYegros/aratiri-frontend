import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/app/LanguageProvider";
import { SendModal } from "@/app/components/dashboard/SendModal";

const apiCall = vi.fn();
const fetchLnurl = vi.fn();

vi.mock("@/app/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api")>(
    "@/app/lib/api"
  );
  return {
    ...actual,
    apiCall: (...args: unknown[]) => apiCall(...args),
  };
});

vi.mock("@/app/lib/spark/lnurl", () => ({
  fetchLnurlBolt11: (...args: unknown[]) => fetchLnurl(...args),
}));

const sparkWallet = {
  transfer: vi.fn(),
  payLightningInvoice: vi.fn(),
  withdraw: vi.fn(),
  getWithdrawalFeeQuote: vi.fn(),
  getLightningSendFeeEstimate: vi.fn(),
};

const useSpark = vi.fn();

vi.mock("@/app/components/spark/SparkProvider", () => ({
  useSpark: () => useSpark(),
}));

const renderSend = (walletKind: "spark" | "custodial" = "spark") =>
  render(
    <LanguageProvider>
      <SendModal
        walletKind={walletKind}
        onClose={vi.fn()}
        onPaymentSent={vi.fn()}
      />
    </LanguageProvider>
  );

const SAMPLE_SPARK =
  "spark1pgssyele0qrcjdheeq2a0zmpwdwvj3r4f4stkuju0fp36g6grapv2w7l8am2cp";

describe("SendModal Spark paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSpark.mockReturnValue({
      wallet: sparkWallet,
      balance: { available: 200_000, owned: 200_000, incoming: 0 },
      trackOutgoing: vi.fn(),
    });
    sparkWallet.transfer.mockResolvedValue({ status: "COMPLETED" });
    sparkWallet.payLightningInvoice.mockResolvedValue({
      typename: "LightningSendRequest",
      id: "ln-1",
      status: "PENDING",
    });
    sparkWallet.getLightningSendFeeEstimate.mockResolvedValue(12);
    fetchLnurl.mockResolvedValue("lnbc1sparkinvoice");
  });

  it("decodes spark1 client-side and transfers without hitting /decoder or custodial pay", async () => {
    const user = userEvent.setup();
    renderSend("spark");

    await user.type(
      screen.getByPlaceholderText(
        /Paste Invoice, LNURL, Bitcoin or Spark address/
      ),
      SAMPLE_SPARK
    );
    await user.click(screen.getByRole("button", { name: "Decode" }));

    expect(apiCall).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Send to a Spark wallet — 0 fee, instant.")
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount (sats)"), "1234");
    await user.click(screen.getByRole("button", { name: /Send 1,234 sats/ }));

    await waitFor(() =>
      expect(sparkWallet.transfer).toHaveBeenCalledWith({
        receiverSparkAddress: SAMPLE_SPARK,
        amountSats: 1234,
      })
    );
    expect(
      apiCall.mock.calls.some(([path]) =>
        String(path).match(/\/payments|\/lnurl/)
      )
    ).toBe(false);
  });

  it("pays LNURL via browser callback + payLightningInvoice (no /lnurl/pay)", async () => {
    const user = userEvent.setup();
    apiCall.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/decoder?input=lnbc1sparkinvoice")) {
        return {
          type: "lightning_invoice",
          data: {
            destination: "x",
            payment_hash: "y",
            num_satoshis: 500,
            description: "Coffee",
            expiry: 60,
          },
        };
      }
      return {
        type: "lnurl_params",
        data: {
          tag: "payRequest",
          status: "OK",
          callback: "https://example.com/lnurl",
          minSendable: 1000,
          maxSendable: 5_000_000,
          metadata: JSON.stringify([["text/plain", "Coffee"]]),
        },
      };
    });
    renderSend("spark");

    await user.type(
      screen.getByPlaceholderText(
        /Paste Invoice, LNURL, Bitcoin or Spark address/
      ),
      "lnurl1dp68gurn8ghj7"
    );
    await user.click(screen.getByRole("button", { name: "Decode" }));
    await screen.findByText("Coffee");
    await user.type(screen.getByLabelText("Amount (sats)"), "500");
    await user.click(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() =>
      expect(fetchLnurl).toHaveBeenCalledWith({
        callback: "https://example.com/lnurl",
        amountMsat: 500_000,
        comment: undefined,
      })
    );
    await waitFor(() =>
      expect(sparkWallet.payLightningInvoice).toHaveBeenCalledWith({
        invoice: "lnbc1sparkinvoice",
        // Math.max(5, round(500 * 0.0017)) = 5 — never a prior invoice's cap
        maxFeeSats: 5,
        preferSpark: true,
      })
    );
    expect(
      apiCall.mock.calls.some(([path]) => path === "/lnurl/pay")
    ).toBe(false);
  });

  it("rejects LNURL invoices whose amount does not match the entered sats", async () => {
    const user = userEvent.setup();
    apiCall.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/decoder?input=lnbc1sparkinvoice")) {
        return {
          type: "lightning_invoice",
          data: {
            destination: "x",
            payment_hash: "y",
            num_satoshis: 9999,
            description: "Coffee",
            expiry: 60,
          },
        };
      }
      return {
        type: "lnurl_params",
        data: {
          tag: "payRequest",
          status: "OK",
          callback: "https://example.com/lnurl",
          minSendable: 1000,
          maxSendable: 5_000_000,
          metadata: JSON.stringify([["text/plain", "Coffee"]]),
        },
      };
    });
    renderSend("spark");
    await user.type(
      screen.getByPlaceholderText(
        /Paste Invoice, LNURL, Bitcoin or Spark address/
      ),
      "lnurl1dp68gurn8ghj7"
    );
    await user.click(screen.getByRole("button", { name: "Decode" }));
    await screen.findByText("Coffee");
    await user.type(screen.getByLabelText("Amount (sats)"), "500");
    await user.click(screen.getByRole("button", { name: "Pay" }));

    expect(
      await screen.findByText(/does not match the amount you entered/)
    ).toBeInTheDocument();
    expect(sparkWallet.payLightningInvoice).not.toHaveBeenCalled();
  });

  it("defaults withdrawal fee deduction on and passes it to withdraw", async () => {
    const user = userEvent.setup();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    apiCall.mockResolvedValue({
      type: "bitcoin_address",
      data: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    });
    sparkWallet.getWithdrawalFeeQuote.mockResolvedValue({
      id: "q1",
      userFeeFast: { originalValue: 250 },
      userFeeMedium: { originalValue: 150 },
      userFeeSlow: { originalValue: 80 },
      l1BroadcastFeeFast: { originalValue: 100 },
      l1BroadcastFeeMedium: { originalValue: 70 },
      l1BroadcastFeeSlow: { originalValue: 40 },
      expiresAt,
    });
    sparkWallet.withdraw.mockResolvedValue({
      typename: "CoopExitRequest",
      id: "w1",
      status: "PENDING",
    });

    renderSend("spark");
    await user.type(
      screen.getByPlaceholderText(
        /Paste Invoice, LNURL, Bitcoin or Spark address/
      ),
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
    );
    await user.click(screen.getByRole("button", { name: "Decode" }));
    await user.type(screen.getByLabelText("Amount (sats)"), "20000");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const toggle = await screen.findByRole("checkbox");
    expect(toggle).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Confirm and Send" }));
    await waitFor(() =>
      expect(sparkWallet.withdraw).toHaveBeenCalledWith(
        expect.objectContaining({
          amountSats: 20000,
          deductFeeFromWithdrawalAmount: true,
        })
      )
    );
    expect(
      apiCall.mock.calls.some(([path]) => path === "/payments/onchain")
    ).toBe(false);
  });

  it("blocks confirm when deducted fee is greater than or equal to amount", async () => {
    const user = userEvent.setup();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    apiCall.mockResolvedValue({
      type: "bitcoin_address",
      data: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    });
    sparkWallet.getWithdrawalFeeQuote.mockResolvedValue({
      id: "q1",
      userFeeFast: { originalValue: 900 },
      userFeeMedium: { originalValue: 150 },
      userFeeSlow: { originalValue: 80 },
      l1BroadcastFeeFast: { originalValue: 200 },
      l1BroadcastFeeMedium: { originalValue: 70 },
      l1BroadcastFeeSlow: { originalValue: 40 },
      expiresAt,
    });

    renderSend("spark");
    await user.type(
      screen.getByPlaceholderText(
        /Paste Invoice, LNURL, Bitcoin or Spark address/
      ),
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
    );
    await user.click(screen.getByRole("button", { name: "Decode" }));
    await user.type(screen.getByLabelText("Amount (sats)"), "500");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText(/Amount must be greater than the fee/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm and Send" })).toBeDisabled();
    expect(sparkWallet.withdraw).not.toHaveBeenCalled();
  });
});
