import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { Dashboard } from "@/app/components/dashboard/Dashboard";
import { LanguageProvider, useLanguage } from "@/app/LanguageProvider";

const apiCall = vi.fn();
const publicApiGet = vi.fn();
let ticketSeq = 0;

vi.mock("@/app/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api")>(
    "@/app/lib/api"
  );
  return {
    ...actual,
    API_BASE_URL: "https://example.test/v1",
    apiCall: (...args: unknown[]) => apiCall(...args),
    publicApiGet: (...args: unknown[]) => publicApiGet(...args),
    mintNotificationWsTicket: async () => {
      ticketSeq += 1;
      return apiCall("/notifications/ws-ticket", { method: "POST" });
    },
  };
});

const currencyStore = {
  selectedCurrency: "usd",
  availableCurrencies: ["usd", "eur"],
  loading: false,
  listeners: new Set<() => void>(),
  setSelectedCurrency(currency: string) {
    currencyStore.selectedCurrency = currency;
    currencyStore.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    currencyStore.listeners.add(listener);
    return () => {
      currencyStore.listeners.delete(listener);
    };
  },
};

vi.mock("@/app/hooks/useCurrency", () => ({
  useCurrency: () => {
    const [, setVersion] = useState(0);
    useEffect(() => currencyStore.subscribe(() => setVersion((v) => v + 1)), []);
    return {
      selectedCurrency: currencyStore.selectedCurrency,
      setSelectedCurrency: currencyStore.setSelectedCurrency,
      availableCurrencies: currencyStore.availableCurrencies,
      loading: currencyStore.loading,
    };
  },
}));

const sockets: MockWebSocket[] = [];

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  close = vi.fn();
  url: string;
  protocols: string | string[] | undefined;
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    sockets.push(this);
    setTimeout(() => this.onopen?.(new Event("open")), 0);
  }
}

function LanguageChanger() {
  const { setLanguage, language } = useLanguage();
  return (
    <button
      type="button"
      data-testid="change-language"
      onClick={() => setLanguage(language === "en" ? "es" : "en")}
    >
      lang
    </button>
  );
}

function CurrencyChanger() {
  return (
    <button
      type="button"
      data-testid="change-currency"
      onClick={() =>
        currencyStore.setSelectedCurrency(
          currencyStore.selectedCurrency === "usd" ? "eur" : "usd"
        )
      }
    >
      currency
    </button>
  );
}

describe("Dashboard payment WebSocket lifetime", () => {
  beforeEach(() => {
    sockets.length = 0;
    ticketSeq = 0;
    currencyStore.selectedCurrency = "usd";
    currencyStore.listeners.clear();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    localStorage.clear();
    localStorage.setItem("aratiri_accessToken", "access-jwt-secret");
    localStorage.setItem("balanceVisible", "true");

    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/notifications/ws-ticket") {
        return {
          ticket: `ticket-${ticketSeq}`,
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
          fiat_equivalents: { usd: 1.23, eur: 1.1 },
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
          currency: currencyStore.selectedCurrency,
          price: 65000,
          updatedAt: "2026-07-29T12:00:00Z",
        };
      }
      return {};
    });
  });

  it("keeps one socket across currency and language changes and cleans up on unmount", async () => {
    const { unmount } = render(
      <LanguageProvider>
        <LanguageChanger />
        <CurrencyChanger />
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("refresh-zap")).toBeInTheDocument()
    );
    await waitFor(() => expect(sockets.length).toBe(1));

    const firstSocket = sockets[0];
    expect(firstSocket.close).not.toHaveBeenCalled();
    expect(firstSocket.url).not.toMatch(/token=/);
    expect(firstSocket.url).not.toMatch(/ticket=/);
    expect(firstSocket.url).not.toContain("access-jwt-secret");
    expect(firstSocket.protocols).toEqual([
      "aratiri.notifications.v1",
      "ticket-1",
    ]);
    expect(apiCall).toHaveBeenCalledWith("/notifications/ws-ticket", {
      method: "POST",
    });

    await act(async () => {
      screen.getByTestId("change-currency").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("refresh-zap")).toBeInTheDocument()
    );

    expect(sockets.length).toBe(1);
    expect(firstSocket.close).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByTestId("change-language").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("refresh-zap")).toBeInTheDocument()
    );

    expect(sockets.length).toBe(1);
    expect(firstSocket.close).not.toHaveBeenCalled();

    act(() => {
      firstSocket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            event: "payment_received",
            data: { amountSats: 42 },
          }),
        })
      );
    });

    await waitFor(() =>
      expect(screen.getByText("Pago recibido")).toBeInTheDocument()
    );

    unmount();
    expect(firstSocket.close).toHaveBeenCalledTimes(1);
  });

  it("mints a fresh ticket on unclean reconnect", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <LanguageProvider>
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() => expect(sockets.length).toBe(1));
    expect(sockets[0].protocols).toEqual([
      "aratiri.notifications.v1",
      "ticket-1",
    ]);

    act(() => {
      sockets[0].onclose?.(
        new CloseEvent("close", { wasClean: false, code: 1006 })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => expect(sockets.length).toBe(2));
    expect(sockets[1].url).not.toMatch(/token=/);
    expect(sockets[1].protocols).toEqual([
      "aratiri.notifications.v1",
      "ticket-2",
    ]);
    expect(
      apiCall.mock.calls.filter(
        (call) => call[0] === "/notifications/ws-ticket"
      ).length
    ).toBe(2);

    vi.useRealTimers();
  });

  it("mints a fresh ticket after policy-violation close", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <LanguageProvider>
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() => expect(sockets.length).toBe(1));

    act(() => {
      sockets[0].onclose?.(
        new CloseEvent("close", { wasClean: true, code: 1008, reason: "invalid ticket" })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => expect(sockets.length).toBe(2));
    expect(sockets[1].protocols).toEqual([
      "aratiri.notifications.v1",
      "ticket-2",
    ]);

    vi.useRealTimers();
  });
});
