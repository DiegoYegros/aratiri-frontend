import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/app/components/dashboard/Dashboard";
import { LanguageProvider } from "@/app/LanguageProvider";

const apiCall = vi.fn();
const publicApiGet = vi.fn();

vi.mock("@/app/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api")>(
    "@/app/lib/api"
  );
  return {
    ...actual,
    API_BASE_URL: "https://example.test/v1",
    apiCall: (...args: unknown[]) => apiCall(...args),
    publicApiGet: (...args: unknown[]) => publicApiGet(...args),
    mintNotificationWsTicket: async () => ({
      ticket: "test-ticket",
      expiresInSeconds: 60,
      expiresAt: "2026-08-06T22:05:00Z",
    }),
  };
});

vi.mock("@/app/hooks/useCurrency", () => ({
  useCurrency: () => ({
    selectedCurrency: "usd",
    setSelectedCurrency: vi.fn(),
    availableCurrencies: ["usd", "eur"],
    loading: false,
  }),
}));

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  close = vi.fn();
  constructor(_url: string) {
    setTimeout(() => this.onopen?.(new Event("open")), 0);
  }
}

describe("Dashboard refresh composition", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    localStorage.clear();
    localStorage.setItem("aratiri_accessToken", "token");
    localStorage.setItem("balanceVisible", "true");

    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/notifications/ws-ticket") {
        return {
          ticket: "test-ticket",
          expiresInSeconds: 60,
          expiresAt: "2026-08-06T22:05:00Z",
        };
      }
      if (endpoint === "/accounts/account") {
        return {
          id: "1",
          balance: 1000,
          alias: "user@aratiri",
          lnurl: "lnurl",
          lnurl_qr_code: "",
          bitcoin_address: "bc1q",
          bitcoin_address_qr_code: "",
          fiat_equivalents: { usd: 1.23 },
        };
      }
      if (endpoint.startsWith("/accounts/account/transactions")) {
        return { transactions: [] };
      }
      return {};
    });
    publicApiGet.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return {
          currency: "usd",
          price: 65000,
          updatedAt: "2026-07-29T12:00:00Z",
        };
      }
      return {};
    });
  });

  it("refreshes only via the Zap control; wordmark is inert", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("refresh-zap")).toBeInTheDocument()
    );

    const accountCallsBefore = apiCall.mock.calls.filter(
      (c) => c[0] === "/accounts/account"
    ).length;
    const priceCallsBefore = publicApiGet.mock.calls.filter((c) =>
      String(c[0]).includes("/general-data/btc-price/current")
    ).length;

    await user.click(screen.getByTestId("brand-wordmark"));
    expect(
      apiCall.mock.calls.filter((c) => c[0] === "/accounts/account").length
    ).toBe(accountCallsBefore);

    await user.click(screen.getByTestId("refresh-zap"));

    await waitFor(() => {
      expect(
        apiCall.mock.calls.filter((c) => c[0] === "/accounts/account").length
      ).toBeGreaterThan(accountCallsBefore);
      expect(
        publicApiGet.mock.calls.filter((c) =>
          String(c[0]).includes("/general-data/btc-price/current")
        ).length
      ).toBeGreaterThan(priceCallsBefore);
    });

    const zap = screen.getByTestId("refresh-zap");
    expect(zap).toBeDisabled();
    expect(zap).toHaveAttribute("aria-busy", "true");

    const accountDuringBusy = apiCall.mock.calls.filter(
      (c) => c[0] === "/accounts/account"
    ).length;
    await user.click(zap);
    expect(
      apiCall.mock.calls.filter((c) => c[0] === "/accounts/account").length
    ).toBe(accountDuringBusy);

    expect(screen.queryByText(/^Refresh$/i)).not.toBeInTheDocument();
  });
});
