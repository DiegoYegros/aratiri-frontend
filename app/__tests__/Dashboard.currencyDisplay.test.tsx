import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { Dashboard } from "@/app/components/dashboard/Dashboard";
import { LanguageProvider } from "@/app/LanguageProvider";
import { formatBtc, formatFiatAmount, formatSats } from "@/app/lib/format";

const apiCall = vi.fn();
const publicApiGet = vi.fn();

const BALANCE_SATS = 123_456_789;
const USD_EQUIV = 1_234.57;
const EUR_EQUIV = 1_123.45;
const TX_SATS = 50_000;
const TX_USD = 0.5;
const TX_EUR = 0.46;

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

vi.mock("@/app/lib/api", () => ({
  API_BASE_URL: "https://example.test/v1",
  apiCall: (...args: unknown[]) => apiCall(...args),
  publicApiGet: (...args: unknown[]) => publicApiGet(...args),
}));

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

const renderDashboard = () =>
  render(
    <LanguageProvider>
      <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
    </LanguageProvider>
  );

const balanceSection = () =>
  screen.getByRole("region", { name: /balance|saldo/i });

const transactionsRegion = () =>
  screen.getByRole("region", {
    name: /transacciones recientes|recent transactions/i,
  });

const unitControl = () =>
  screen.getByRole("button", {
    name: /change display unit|cambiar unidad de visualización/i,
  });

const unitControlsIn = (section: HTMLElement) =>
  within(section).getAllByRole("button", {
    name: /change display unit|cambiar unidad de visualización/i,
  });

const heroAmount = (text: string) => {
  const amount = within(balanceSection()).getByText(text);
  expect(amount.tagName).toBe("P");
  return amount;
};

const cycleToFiat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(unitControl()); // sats -> btc
  await user.click(unitControl()); // btc -> fiat
};

describe("Dashboard currency display polish", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    localStorage.clear();
    localStorage.setItem("aratiri_accessToken", "token");
    localStorage.setItem("balanceVisible", "true");
    currencyStore.selectedCurrency = "usd";
    currencyStore.listeners.clear();

    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/accounts/account") {
        return {
          id: "1",
          balance: BALANCE_SATS,
          alias: "user@aratiri",
          lnurl: "lnurl",
          lnurl_qr_code: "",
          bitcoin_address: "bc1q",
          bitcoin_address_qr_code: "",
          fiat_equivalents: { usd: USD_EQUIV, eur: EUR_EQUIV },
        };
      }
      if (endpoint.startsWith("/accounts/account/transactions")) {
        return {
          transactions: [
            {
              id: "tx-1",
              type: "LIGHTNING_CREDIT",
              amount: TX_SATS,
              date: "2026-07-29T12:00:00Z",
              status: "COMPLETED",
              fiat_equivalents: { usd: TX_USD, eur: TX_EUR },
            },
          ],
        };
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

  it("shows fiat hero as a plain amount plus exactly one ISO unit control", async () => {
    localStorage.setItem("preferredLanguage", "es");
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());
    await cycleToFiat(user);

    const section = balanceSection();
    const expectedFiat = formatFiatAmount(USD_EQUIV, "es-ES");
    const amount = heroAmount(expectedFiat);
    expect(amount.textContent).toBe(expectedFiat);
    expect(amount.textContent).not.toMatch(/\$|US\$|USD|EUR|Unidad|Unit/);

    expect(unitControlsIn(section)).toHaveLength(1);
    expect(unitControl()).toHaveAccessibleName(
      "Cambiar unidad de visualización. Unidad actual: USD"
    );
    expect(unitControl()).toHaveTextContent("USD");
    expect(unitControl()).toHaveClass("min-h-11", "min-w-11");

    expect(
      within(section).queryByText(/1 BTC ≈/)
    ).not.toBeInTheDocument();
  });

  it("updates the fiat unit control when the selected currency changes to EUR", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());
    await cycleToFiat(user);

    expect(unitControl()).toHaveTextContent("USD");
    heroAmount(formatFiatAmount(USD_EQUIV, "en-US"));

    await act(async () => {
      currencyStore.setSelectedCurrency("eur");
    });

    await waitFor(() => {
      expect(unitControl()).toHaveTextContent("EUR");
    });
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: EUR"
    );
    expect(unitControlsIn(balanceSection())).toHaveLength(1);
    heroAmount(formatFiatAmount(EUR_EQUIV, "en-US"));
  });

  it("formats non-zero sats and btc in the hero and shows spot price only for those units", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());

    const satsAmount = formatSats(BALANCE_SATS, "en-US");
    expect(heroAmount(satsAmount).textContent).toBe(satsAmount);
    expect(unitControl()).toHaveTextContent("sats");
    expect(
      within(balanceSection()).getByText(/1 BTC ≈/)
    ).toBeInTheDocument();

    await user.click(unitControl());
    const btcAmount = formatBtc(BALANCE_SATS);
    expect(btcAmount).toBe("1.23456789");
    expect(heroAmount(btcAmount).textContent).toBe(btcAmount);
    expect(unitControl()).toHaveTextContent("btc");
    expect(
      within(balanceSection()).getByText(/1 BTC ≈/)
    ).toBeInTheDocument();

    await user.click(unitControl());
    expect(unitControl()).toHaveTextContent("USD");
    expect(
      within(balanceSection()).queryByText(/1 BTC ≈/)
    ).not.toBeInTheDocument();
  });

  it("cycles display units via click and keyboard (Enter and Space)", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());

    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: sats"
    );
    expect(unitControl()).toHaveTextContent("sats");
    expect(unitControl()).toHaveClass("min-h-11", "min-w-11");

    await user.click(unitControl());
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: btc"
    );
    expect(unitControl()).toHaveTextContent("btc");

    unitControl().focus();
    await user.keyboard("{Enter}");
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: USD"
    );
    expect(unitControl()).toHaveTextContent("USD");

    unitControl().focus();
    await user.keyboard(" ");
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: sats"
    );
    expect(unitControl()).toHaveTextContent("sats");
  });

  it("hides the unit control when balance is hidden and restores it with the current unit", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());
    await user.click(unitControl()); // sats -> btc

    await user.click(screen.getByRole("button", { name: /hide balance/i }));
    expect(
      screen.queryByRole("button", {
        name: /change display unit/i,
      })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show balance/i }));
    expect(unitControl()).toHaveTextContent("btc");
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: btc"
    );
  });

  it("does not change displayUnit when a transaction amount is clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => expect(unitControl()).toBeInTheDocument());
    expect(unitControl()).toHaveTextContent("sats");

    const transactions = transactionsRegion();
    expect(
      within(transactions).queryByRole("button", {
        name: /change display unit|cambiar unidad/i,
      })
    ).not.toBeInTheDocument();
    expect(within(transactions).queryByText(/^Unidad$/i)).not.toBeInTheDocument();
    expect(within(transactions).queryByText(/^Unit$/i)).not.toBeInTheDocument();

    const txAmount = within(transactions).getByText(
      new RegExp(`${formatSats(TX_SATS, "en-US")} sats`)
    );
    await user.click(txAmount);

    expect(unitControl()).toHaveTextContent("sats");
    expect(unitControl()).toHaveAccessibleName(
      "Change display unit. Current unit: sats"
    );
    expect(heroAmount(formatSats(BALANCE_SATS, "en-US"))).toBeInTheDocument();
  });
});
