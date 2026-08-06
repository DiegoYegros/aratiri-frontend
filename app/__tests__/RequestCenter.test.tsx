import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/app/components/dashboard/Dashboard";
import { RequestCenter } from "@/app/components/dashboard/RequestCenter";
import { RequestDetailModal } from "@/app/components/dashboard/RequestDetailModal";
import { LanguageProvider } from "@/app/LanguageProvider";
import type { PaymentRequest } from "@/app/lib/api";
import {
  PAYMENT_REQUEST_POLL_INTERVAL_MS,
  PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS,
} from "@/app/lib/paymentRequests";

const apiCall = vi.fn();

vi.mock("@/app/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api")>(
    "@/app/lib/api"
  );
  return {
    ...actual,
    API_BASE_URL: "https://example.test/v1",
    apiCall: (...args: unknown[]) => apiCall(...args),
    publicApiGet: (...args: unknown[]) => apiCall(...args),
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

vi.mock("@/app/components/ui/LocalQrCode", () => ({
  LocalQrCode: ({ alt }: { alt: string }) => (
    <img data-testid="local-qr" alt={alt} src="data:image/png;base64,qq" />
  ),
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
  constructor(url: string) {
    this.url = url;
    sockets.push(this);
    setTimeout(() => this.onopen?.(new Event("open")), 0);
  }
}

const sampleRequest = (overrides: Partial<PaymentRequest> = {}): PaymentRequest => ({
  public_id: "req-1",
  share_url: "https://api.example/r/req-1",
  amount_sats: 2500,
  memo: "Coffee",
  status: "pending",
  payment_request: "lnbc2500n1...",
  created_at: "2026-07-01T12:00:00Z",
  expires_at: "2099-07-02T12:00:00Z",
  paid_at: null,
  cancelled_at: null,
  ...overrides,
});

const writeText = vi.fn().mockResolvedValue(undefined);

describe("Request Center authenticated flows", () => {
  beforeEach(() => {
    sockets.length = 0;
    writeText.mockClear();
    apiCall.mockReset();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Reflect.deleteProperty(navigator, "share");
    localStorage.clear();
    localStorage.setItem("aratiri_accessToken", "token");
    localStorage.setItem("balanceVisible", "true");

    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return {
          currency: "usd",
          price: 65000,
          updatedAt: "2026-07-29T12:00:00Z",
        };
      }
      if (
        endpoint.startsWith("/payment-requests?") &&
        endpoint.includes("cursor=cursor-2")
      ) {
        return {
          payment_requests: [
            sampleRequest({ public_id: "req-2", amount_sats: 500, memo: "Tea" }),
          ],
          next_cursor: null,
          has_more: false,
        };
      }
      if (
        endpoint.startsWith("/payment-requests?") &&
        (!options || !options.method || options.method === "GET")
      ) {
        return {
          payment_requests: [sampleRequest()],
          next_cursor: "cursor-2",
          has_more: true,
        };
      }
      if (endpoint === "/payment-requests" && options?.method === "POST") {
        return sampleRequest({ public_id: "req-new", amount_sats: 100 });
      }
      if (endpoint === "/payment-requests/req-1") {
        return sampleRequest();
      }
      if (endpoint === "/payment-requests/req-1/cancel") {
        return sampleRequest({
          status: "cancelled",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function goToRequests(user: ReturnType<typeof userEvent.setup>) {
    render(
      <LanguageProvider>
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Requests" })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "Requests" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Requests" })).toBeInTheDocument()
    );
  }

  it("lists requests with status, amount, memo and supports pagination", async () => {
    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByText("2,500 sats")).toBeInTheDocument();
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Tea")).toBeInTheDocument());
    expect(screen.getByText("500 sats")).toBeInTheDocument();
  });

  it("masks request amounts when balanceVisible is false", async () => {
    localStorage.setItem("balanceVisible", "false");
    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByText("•••••••")).toBeInTheDocument();
    expect(screen.queryByText("2,500 sats")).not.toBeInTheDocument();
  });

  it("toggles amount masking from Requests without switching to Wallet", async () => {
    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByText("2,500 sats")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide amounts" }));
    expect(screen.getByText("•••••••")).toBeInTheDocument();
    expect(screen.queryByText("2,500 sats")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("balanceVisible")!)).toBe(false);
    expect(screen.getByRole("heading", { name: "Requests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requests" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(screen.getByRole("button", { name: "Show amounts" }));
    expect(screen.getByText("2,500 sats")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("balanceVisible")!)).toBe(true);
  });

  it("uses Hide/Show amounts on Requests and keeps Hide/Show balance on Custodial", async () => {
    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByRole("button", { name: "Hide amounts" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide balance" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show balance" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Custodial" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Hide balance" })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "Hide amounts" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show amounts" })
    ).not.toBeInTheDocument();
  });

  it("masks amounts in the detail modal when visibility is hidden", async () => {
    localStorage.setItem("balanceVisible", "false");
    const user = userEvent.setup();
    await goToRequests(user);

    await user.click(
      screen.getByRole("button", { name: /View request for •••••••/i })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("•••••••")).toBeInTheDocument();
    expect(within(dialog).queryByText("2,500 sats")).not.toBeInTheDocument();
  });

  it("uses Spanish Hide/Show amounts copy on Requests", async () => {
    localStorage.setItem("preferredLanguage", "es");
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Dashboard setIsAuthenticated={vi.fn()} setToken={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Solicitudes" })
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "Solicitudes" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Solicitudes" })
      ).toBeInTheDocument()
    );

    expect(
      screen.getByRole("button", { name: "Ocultar montos" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ocultar saldo" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar montos" }));
    expect(
      screen.getByRole("button", { name: "Mostrar montos" })
    ).toBeInTheDocument();
  });

  it("creates a request with snake_case body and stable Idempotency-Key across rapid clicks", async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: PaymentRequest) => void) | undefined;
    const createCalls: Array<{ headers: Headers; body: string }> = [];

    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (endpoint.startsWith("/payment-requests?")) {
        return { payment_requests: [], next_cursor: null, has_more: false };
      }
      if (endpoint === "/payment-requests" && options?.method === "POST") {
        createCalls.push({
          headers: new Headers(options.headers),
          body: String(options.body),
        });
        return new Promise<PaymentRequest>((resolve) => {
          resolveCreate = resolve;
        });
      }
      if (endpoint === "/payment-requests/req-new") {
        return sampleRequest({ public_id: "req-new", amount_sats: 100 });
      }
      return {};
    });

    await goToRequests(user);
    await user.click(screen.getByRole("button", { name: "New Request" }));

    await user.type(screen.getByLabelText("Amount (sats)"), "100");
    await user.type(screen.getByLabelText("Memo (optional)"), "Tip");

    const submit = screen.getByRole("button", { name: "Create Request" });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    expect(createCalls).toHaveLength(1);
    expect(JSON.parse(createCalls[0].body)).toEqual({
      amount_sats: 100,
      expires_in_seconds: 86400,
      memo: "Tip",
    });
    const key = createCalls[0].headers.get("Idempotency-Key");
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    resolveCreate?.(sampleRequest({ public_id: "req-new", amount_sats: 100 }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Request Details" })).toBeInTheDocument()
    );
  });

  it("reuses the same Idempotency-Key on exact retry, regenerates after payload edit", async () => {
    const user = userEvent.setup();
    const createKeys: string[] = [];
    const createBodies: string[] = [];
    let attempt = 0;

    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (endpoint.startsWith("/payment-requests?")) {
        return { payment_requests: [], next_cursor: null, has_more: false };
      }
      if (endpoint === "/payment-requests" && options?.method === "POST") {
        const key = new Headers(options.headers).get("Idempotency-Key") || "";
        createKeys.push(key);
        createBodies.push(String(options.body));
        attempt += 1;
        if (attempt <= 2) {
          throw new Error("Temporary failure");
        }
        return sampleRequest({ public_id: "req-retry", amount_sats: 75 });
      }
      if (endpoint === "/payment-requests/req-retry") {
        return sampleRequest({ public_id: "req-retry", amount_sats: 75 });
      }
      return {};
    });

    await goToRequests(user);
    await user.click(screen.getByRole("button", { name: "New Request" }));
    await user.type(screen.getByLabelText("Amount (sats)"), "50");

    await user.click(screen.getByRole("button", { name: "Create Request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary failure");

    // Exact retry keeps the same Idempotency-Key.
    await user.click(screen.getByRole("button", { name: "Create Request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary failure");
    expect(createKeys).toHaveLength(2);
    expect(createKeys[0]).toBe(createKeys[1]);
    expect(JSON.parse(createBodies[0])).toEqual(JSON.parse(createBodies[1]));

    // Editing the payload before retry regenerates a new key.
    const amount = screen.getByLabelText("Amount (sats)");
    await user.clear(amount);
    await user.type(amount, "75");
    await user.click(screen.getByRole("button", { name: "Create Request" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Request Details" })).toBeInTheDocument()
    );

    expect(createKeys).toHaveLength(3);
    expect(createKeys[2]).not.toBe(createKeys[0]);
    expect(JSON.parse(createBodies[2])).toEqual({
      amount_sats: 75,
      expires_in_seconds: 86400,
    });
    expect(createKeys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("shows the empty request state when there are no payment requests", async () => {
    apiCall.mockImplementation(async (endpoint: string) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (endpoint.startsWith("/payment-requests?")) {
        return { payment_requests: [], next_cursor: null, has_more: false };
      }
      return {};
    });

    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByText("No payment requests yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Create a request to share a Lightning invoice link.")
    ).toBeInTheDocument();
    const emptyFrame = screen
      .getByText("No payment requests yet.")
      .closest("[role='status']");
    expect(emptyFrame).toHaveClass(
      "border-dashed",
      "border-panel-edge",
      "rounded-lg"
    );
  });

  it("preserves already-loaded cursor pages on WS/Zap list refresh", async () => {
    let page1Memo = "Coffee";
    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (
        endpoint.startsWith("/payment-requests?") &&
        endpoint.includes("cursor=cursor-2")
      ) {
        return {
          payment_requests: [
            sampleRequest({ public_id: "req-2", amount_sats: 500, memo: "Tea" }),
          ],
          next_cursor: null,
          has_more: false,
        };
      }
      if (
        endpoint.startsWith("/payment-requests?") &&
        (!options || !options.method || options.method === "GET")
      ) {
        return {
          payment_requests: [
            sampleRequest({ public_id: "req-1", memo: page1Memo }),
          ],
          next_cursor: "cursor-2",
          has_more: true,
        };
      }
      return {};
    });

    const user = userEvent.setup();
    await goToRequests(user);
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Tea")).toBeInTheDocument());

    await waitFor(() => expect(sockets.length).toBe(1));
    page1Memo = "Coffee refreshed";

    await act(async () => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            event: "payment_received",
            data: { amountSats: 2500, memo: "Coffee" },
          }),
        })
      );
    });

    await waitFor(() =>
      expect(screen.getByText("Coffee refreshed")).toBeInTheDocument()
    );
    expect(screen.getByText("Tea")).toBeInTheDocument();
    expect(screen.getByText("500 sats")).toBeInTheDocument();
    // Both previously loaded pages were refetched; no duplicate rows.
    expect(screen.getAllByText("Tea")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    const listCalls = apiCall.mock.calls.filter(([ep]) =>
      String(ep).startsWith("/payment-requests?")
    );
    const refreshPage1 = listCalls.filter(
      ([ep]) =>
        String(ep).startsWith("/payment-requests?") &&
        !String(ep).includes("cursor=")
    );
    const refreshPage2 = listCalls.filter(([ep]) =>
      String(ep).includes("cursor=cursor-2")
    );
    // Initial + load-more + refresh of both pages
    expect(refreshPage1.length).toBeGreaterThanOrEqual(2);
    expect(refreshPage2.length).toBeGreaterThanOrEqual(2);
  });

  it("shows API failure state for the request list", async () => {
    apiCall.mockImplementation(async (endpoint: string) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (endpoint.startsWith("/payment-requests")) {
        throw new Error("Requests unavailable");
      }
      return {};
    });

    const user = userEvent.setup();
    await goToRequests(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Requests unavailable"
    );
  });

  it("opens details, copies share link, and cancels a pending request", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await goToRequests(user);

    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Coffee")).toBeInTheDocument();
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();
    expect(
      within(dialog).getByText(`${window.location.origin}/pay/req-1`)
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Copy share link" }));
    expect(await screen.findAllByText("Link copied")).not.toHaveLength(0);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/pay/req-1`
    );

    await user.click(within(dialog).getByRole("button", { name: "Cancel Request" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm Cancel" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Cancelled")).toBeInTheDocument()
    );
  });

  it("treats backend OPEN as payable and cancellable in request details", async () => {
    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (endpoint.startsWith("/payment-requests?")) {
        return {
          payment_requests: [sampleRequest({ status: "OPEN" })],
          next_cursor: null,
          has_more: false,
        };
      }
      if (endpoint === "/payment-requests/req-1") {
        return sampleRequest({ status: "OPEN" });
      }
      if (endpoint === "/payment-requests/req-1/cancel" && options?.method === "POST") {
        return sampleRequest({
          status: "CANCELLED",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return {};
    });

    const user = userEvent.setup();
    await goToRequests(user);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();
    expect(within(dialog).getByText("Pending")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel Request" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm Cancel" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Cancelled")).toBeInTheDocument()
    );
  });

  it("shares from owner detail and ignores user-cancelled share", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("Share canceled", "AbortError"));
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    const user = userEvent.setup();
    await goToRequests(user);

    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith({
      title: "Payment Request",
      text: "Pay this Lightning request",
      url: `${window.location.origin}/pay/req-1`,
    });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("enforces memo maxLength=500 on the create form", async () => {
    const user = userEvent.setup();
    await goToRequests(user);
    await user.click(screen.getByRole("button", { name: "New Request" }));

    const memo = screen.getByLabelText("Memo (optional)");
    expect(memo).toHaveAttribute("maxLength", "500");
  });

  it("refreshes an open detail after list/WebSocket refresh without a second socket", async () => {
    let listStatus: string = "OPEN";
    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
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
      if (endpoint.startsWith("/general-data/btc-price/current")) {
        return { currency: "usd", price: 65000, updatedAt: "2026-07-29T12:00:00Z" };
      }
      if (
        endpoint.startsWith("/payment-requests?") &&
        (!options || !options.method || options.method === "GET")
      ) {
        return {
          payment_requests: [
            sampleRequest({
              status: listStatus,
              paid_at: listStatus === "PAID" ? "2026-07-01T13:00:00Z" : null,
              payment_request: listStatus === "OPEN" ? "lnbc2500n1..." : null,
            }),
          ],
          next_cursor: null,
          has_more: false,
        };
      }
      if (endpoint === "/payment-requests/req-1") {
        return sampleRequest({
          status: listStatus,
          paid_at: listStatus === "PAID" ? "2026-07-01T13:00:00Z" : null,
          payment_request: listStatus === "OPEN" ? "lnbc2500n1..." : null,
        });
      }
      return {};
    });

    const user = userEvent.setup();
    await goToRequests(user);
    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();
    expect(within(dialog).getByText("Pending")).toBeInTheDocument();

    await waitFor(() => expect(sockets.length).toBe(1));
    listStatus = "PAID";

    await act(async () => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            event: "payment_received",
            data: { amountSats: 2500, memo: "Coffee" },
          }),
        })
      );
    });

    await waitFor(() =>
      expect(within(dialog).getByText("Paid")).toBeInTheDocument()
    );
    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(sockets.length).toBe(1);
  });

  it("refreshes requests on payment_received without opening a second socket", async () => {
    const user = userEvent.setup();
    await goToRequests(user);

    await waitFor(() => expect(sockets.length).toBe(1));
    const listCallsBefore = apiCall.mock.calls.filter(([ep]) =>
      String(ep).startsWith("/payment-requests?")
    ).length;

    await act(async () => {
      sockets[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            event: "payment_received",
            data: { amountSats: 10, memo: "hi" },
          }),
        })
      );
    });

    await waitFor(() => {
      const listCallsAfter = apiCall.mock.calls.filter(([ep]) =>
        String(ep).startsWith("/payment-requests?")
      ).length;
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore);
    });

    expect(sockets.length).toBe(1);
  });
});

describe("RequestCenter Quiet Edge list language", () => {
  beforeEach(() => {
    apiCall.mockReset();
  });

  it("renders dense instrument rows with scannable amount, memo, status, and date", async () => {
    const request = sampleRequest();
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint).startsWith("/payment-requests?")) {
        return {
          payment_requests: [request],
          next_cursor: null,
          has_more: false,
        };
      }
      if (String(endpoint) === "/payment-requests/req-1") {
        return request;
      }
      return {};
    });

    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    const list = await screen.findByRole("list", { name: "Payment requests" });
    expect(list).toHaveClass("space-y-2");

    const row = within(list).getByRole("button", {
      name: /View request for 2,500 sats/i,
    });
    expect(row).toHaveClass("min-h-11");
    expect(within(row).getByText("2,500 sats")).toBeInTheDocument();
    expect(within(row).getByText("Coffee")).toBeInTheDocument();
    const status = within(row).getByText("Pending");
    expect(status).toHaveClass("text-sm", "text-pending");
    expect(status).not.toHaveClass("border", "rounded-md");
    // Relative/absolute date under memo (TZ-stable: presence via created_at formatting path).
    expect(within(row).getByText("Coffee").nextElementSibling).not.toBeNull();

    await user.click(row);
    expect(
      await screen.findByRole("heading", { name: "Request Details" })
    ).toBeInTheDocument();
  });

  it("shows quiet status text without chip roles", async () => {
    apiCall.mockResolvedValue({
      payment_requests: [
        sampleRequest({ public_id: "req-open", status: "OPEN", memo: "Open one" }),
        sampleRequest({
          public_id: "req-paid",
          status: "PAID",
          memo: "Paid one",
          paid_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        }),
        sampleRequest({
          public_id: "req-cancelled",
          status: "CANCELLED",
          memo: "Cancelled one",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        }),
        sampleRequest({
          public_id: "req-expired",
          status: "EXPIRED",
          memo: "Expired one",
          payment_request: null,
        }),
      ],
      next_cursor: null,
      has_more: false,
    });

    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    const list = await screen.findByRole("list", { name: "Payment requests" });
    const pending = within(list).getByText("Pending");
    const paid = within(list).getByText("Paid");
    const cancelled = within(list).getByText("Cancelled");
    const expired = within(list).getByText("Expired");

    expect(pending).toHaveClass("text-sm", "text-pending");
    expect(paid).toHaveClass("text-sm", "text-success");
    expect(cancelled).toHaveClass("text-sm", "text-danger");
    expect(expired).toHaveClass("text-sm", "text-muted");
    for (const node of [pending, paid, cancelled, expired]) {
      expect(node).not.toHaveClass("border", "rounded-md");
    }

    // Status labels are plain text in the row; only row openers are buttons.
    expect(within(list).queryByRole("status")).not.toBeInTheDocument();
    expect(within(list).getAllByRole("button")).toHaveLength(4);
  });

  it("keeps row touch targets at min-h-11 when amounts are masked", async () => {
    apiCall.mockResolvedValue({
      payment_requests: [sampleRequest()],
      next_cursor: null,
      has_more: false,
    });

    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible={false}
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    const row = await screen.findByRole("button", {
      name: /View request for •••••••/i,
    });
    expect(row).toHaveClass("min-h-11");
    expect(within(row).getByText("•••••••")).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
  });
});

describe("RequestDetailModal polling", () => {
  beforeEach(() => {
    apiCall.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const detailCalls = () =>
    apiCall.mock.calls.filter(([ep]) => {
      const path = String(ep);
      return (
        path.startsWith("/payment-requests/") &&
        !path.includes("?") &&
        !path.endsWith("/cancel")
      );
    });

  it("accepts successful initial GET when listRequest is absent", async () => {
    apiCall.mockResolvedValue(sampleRequest({ status: "OPEN" }));
    const onUpdated = vi.fn();

    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("2,500 sats")).toBeInTheDocument();
    expect(screen.getByTestId("local-qr")).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ public_id: "req-1", status: "OPEN" })
    );
  });

  it("does not call onUpdated for unchanged OPEN detail polls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const openRequest = sampleRequest({ status: "OPEN" });
    apiCall.mockResolvedValue(openRequest);
    const onUpdated = vi.fn();

    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={openRequest}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailCalls().length).toBeGreaterThanOrEqual(1));
    onUpdated.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(detailCalls().length).toBeGreaterThanOrEqual(2));

    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("stops scheduling polls after terminal list sync", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiCall.mockResolvedValue(sampleRequest({ status: "OPEN" }));

    const listRequest = sampleRequest({ status: "OPEN" });
    const { rerender } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={listRequest}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailCalls().length).toBeGreaterThanOrEqual(1));
    const callsAfterOpen = detailCalls().length;

    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({
            status: "PAID",
            paid_at: "2026-07-01T13:00:00Z",
            payment_request: null,
          })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Paid")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 3);
    });
    expect(detailCalls().length).toBe(callsAfterOpen);
  });

  it("keeps bounded terminal reconciliation after cancel (does not use OPEN interval)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiCall.mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint === "/payment-requests/req-1" && options?.method === "POST") {
        // cancel uses /cancel suffix
      }
      if (endpoint === "/payment-requests/req-1/cancel") {
        return sampleRequest({
          status: "cancelled",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return sampleRequest({ status: "OPEN" });
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailCalls().length).toBeGreaterThanOrEqual(1));

    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();

    const callsAfterCancel = detailCalls().length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    // OPEN interval must not fire; terminal reconcile is slower.
    expect(detailCalls().length).toBe(callsAfterCancel);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS
      );
    });
    expect(detailCalls().length).toBeGreaterThan(callsAfterCancel);
  });

  it("retries OPEN refresh errors without overlapping in-flight polls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let detailHits = 0;
    let inFlightOverlaps = 0;
    let currentlyInFlight = false;

    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint) === "/payment-requests/req-1") {
        detailHits += 1;
        if (currentlyInFlight) inFlightOverlaps += 1;
        currentlyInFlight = true;
        try {
          if (detailHits === 1) {
            return sampleRequest({ status: "OPEN" });
          }
          // Refresh failures while still OPEN.
          throw new Error("Transient detail failure");
        } finally {
          currentlyInFlight = false;
        }
      }
      return {};
    });

    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailHits).toBe(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(detailHits).toBe(2));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(detailHits).toBe(3));

    expect(inFlightOverlaps).toBe(0);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("ignores in-flight OPEN GET after cancel (does not onUpdated/regress; may reconcile later)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveDetail: ((value: PaymentRequest) => void) | undefined;
    let detailHits = 0;
    const onUpdated = vi.fn();

    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payment-requests/req-1/cancel") {
        return sampleRequest({
          status: "cancelled",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      if (String(endpoint) === "/payment-requests/req-1") {
        detailHits += 1;
        if (detailHits === 1) {
          return sampleRequest({ status: "OPEN" });
        }
        if (detailHits === 2) {
          return new Promise<PaymentRequest>((resolve) => {
            resolveDetail = resolve;
          });
        }
        return sampleRequest({
          status: "cancelled",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return {};
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailHits).toBe(1));
    onUpdated.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(detailHits).toBe(2));
    expect(resolveDetail).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    onUpdated.mockClear();

    await act(async () => {
      resolveDetail?.(sampleRequest({ status: "OPEN" }));
    });

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();

    // Allow cancel's immediate reconcile / pending-load drain to settle.
    await act(async () => {
      await Promise.resolve();
    });
    const callsAfterStaleIgnored = detailHits;

    // Stale OPEN resolution must not restart the fast OPEN poll interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    expect(detailHits).toBe(callsAfterStaleIgnored);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS
      );
    });
    expect(detailHits).toBeGreaterThan(callsAfterStaleIgnored);
  });

  it("ignores in-flight OPEN GET after list PAID sync (does not onUpdated/restart poll)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveDetail: ((value: PaymentRequest) => void) | undefined;
    let detailHits = 0;
    const onUpdated = vi.fn();

    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint) === "/payment-requests/req-1") {
        detailHits += 1;
        if (detailHits === 1) {
          return sampleRequest({ status: "OPEN" });
        }
        return new Promise<PaymentRequest>((resolve) => {
          resolveDetail = resolve;
        });
      }
      return {};
    });

    const { rerender } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailHits).toBe(1));
    onUpdated.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(detailHits).toBe(2));
    expect(resolveDetail).toBeDefined();

    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({
            status: "PAID",
            paid_at: "2026-07-01T13:00:00Z",
            payment_request: null,
          })}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    const callsAfterPaid = detailHits;
    onUpdated.mockClear();

    await act(async () => {
      resolveDetail?.(sampleRequest({ status: "OPEN" }));
    });

    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 3);
    });
    expect(detailHits).toBe(callsAfterPaid);
  });

  it("ignores stale OPEN listRequest after cancel (no QR/cancel restart)", async () => {
    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payment-requests/req-1/cancel") {
        return sampleRequest({
          status: "cancelled",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return sampleRequest({ status: "OPEN" });
    });

    const user = userEvent.setup();
    const { rerender } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN", memo: "stale" })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Request" })
    ).not.toBeInTheDocument();
  });

  it("accepts CANCELLED → PAID listRequest settlement advance", async () => {
    apiCall.mockResolvedValue(
      sampleRequest({
        status: "CANCELLED",
        cancelled_at: "2026-07-01T13:00:00Z",
        payment_request: null,
      })
    );

    const { rerender } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({
            status: "CANCELLED",
            cancelled_at: "2026-07-01T13:00:00Z",
            payment_request: null,
          })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({
            status: "PAID",
            paid_at: "2026-07-01T14:00:00Z",
            cancelled_at: "2026-07-01T13:00:00Z",
            payment_request: null,
          })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
  });
});

describe("RequestCenter refresh/load-more races", () => {
  beforeEach(() => {
    apiCall.mockReset();
  });

  type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
  };

  const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  const page1 = () => ({
    payment_requests: [sampleRequest({ public_id: "req-1", memo: "Coffee" })],
    next_cursor: "cursor-2",
    has_more: true,
  });

  const page2 = () => ({
    payment_requests: [
      sampleRequest({ public_id: "req-2", amount_sats: 500, memo: "Tea" }),
    ],
    next_cursor: null,
    has_more: false,
  });

  it("preserves loaded pages when refresh completes before overlapping load-more", async () => {
    const refreshPage1 = deferred<ReturnType<typeof page1>>();
    const loadMorePage2 = deferred<ReturnType<typeof page2>>();
    let initialDone = false;
    let refreshStarted = false;
    let loadMoreStarted = false;

    apiCall.mockImplementation(async (endpoint: string) => {
      const ep = String(endpoint);
      if (ep.includes("cursor=cursor-2")) {
        loadMoreStarted = true;
        return loadMorePage2.promise;
      }
      if (ep.startsWith("/payment-requests?")) {
        if (!initialDone) {
          initialDone = true;
          return page1();
        }
        refreshStarted = true;
        return refreshPage1.promise;
      }
      return {};
    });

    const refreshRef: { current: (() => Promise<void>) | null } = {
      current: null,
    };
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={(fn) => {
            refreshRef.current = fn;
          }}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Coffee")).toBeInTheDocument();
    await waitFor(() => expect(refreshRef.current).not.toBeNull());

    const user = userEvent.setup();
    const refreshPromise = refreshRef.current!();
    await waitFor(() => expect(refreshStarted).toBe(true));

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(
      screen.getByRole("button", { name: "Loading..." })
    ).toBeInTheDocument();

    await act(async () => {
      refreshPage1.resolve(page1());
    });
    await refreshPromise;

    await waitFor(() => expect(loadMoreStarted).toBe(true));
    await act(async () => {
      loadMorePage2.resolve(page2());
    });

    await waitFor(() => expect(screen.getByText("Tea")).toBeInTheDocument());
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getAllByText("Coffee")).toHaveLength(1);
    expect(screen.getAllByText("Tea")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();
  });

  it("preserves loaded pages when load-more completes before overlapping refresh", async () => {
    const loadMorePage2 = deferred<ReturnType<typeof page2>>();
    const refreshPage1 = deferred<ReturnType<typeof page1>>();
    const refreshPage2 = deferred<ReturnType<typeof page2>>();
    let initialDone = false;
    let loadMoreStarted = false;
    let refreshPage1Hits = 0;
    let refreshPage2Hits = 0;

    apiCall.mockImplementation(async (endpoint: string) => {
      const ep = String(endpoint);
      if (ep.includes("cursor=cursor-2")) {
        if (loadMoreStarted && refreshPage1Hits > 0) {
          refreshPage2Hits += 1;
          return refreshPage2.promise;
        }
        loadMoreStarted = true;
        return loadMorePage2.promise;
      }
      if (ep.startsWith("/payment-requests?")) {
        if (!initialDone) {
          initialDone = true;
          return page1();
        }
        refreshPage1Hits += 1;
        return refreshPage1.promise;
      }
      return {};
    });

    const refreshRef: { current: (() => Promise<void>) | null } = {
      current: null,
    };
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={(fn) => {
            refreshRef.current = fn;
          }}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Coffee")).toBeInTheDocument();
    await waitFor(() => expect(refreshRef.current).not.toBeNull());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(loadMoreStarted).toBe(true));

    const refreshPromise = refreshRef.current!();

    await act(async () => {
      loadMorePage2.resolve(page2());
    });
    await waitFor(() => expect(screen.getByText("Tea")).toBeInTheDocument());

    await waitFor(() => expect(refreshPage1Hits).toBeGreaterThanOrEqual(1));
    await act(async () => {
      refreshPage1.resolve({
        payment_requests: [
          sampleRequest({ public_id: "req-1", memo: "Coffee refreshed" }),
        ],
        next_cursor: "cursor-2",
        has_more: true,
      });
    });
    await waitFor(() => expect(refreshPage2Hits).toBeGreaterThanOrEqual(1));
    await act(async () => {
      refreshPage2.resolve(page2());
    });
    await refreshPromise;

    await waitFor(() =>
      expect(screen.getByText("Coffee refreshed")).toBeInTheDocument()
    );
    expect(screen.getByText("Tea")).toBeInTheDocument();
    expect(screen.getAllByText("Tea")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();
  });
});

describe("RequestCenter monotonic terminal status", () => {
  beforeEach(() => {
    apiCall.mockReset();
  });

  type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
  };

  const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  it("keeps list card and open detail cancelled when stale refresh returns OPEN after local cancel", async () => {
    const staleRefresh = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    let initialDone = false;

    apiCall.mockImplementation(async (endpoint: string) => {
      const ep = String(endpoint);
      if (ep === "/payment-requests/req-1/cancel") {
        return sampleRequest({
          status: "CANCELLED",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      if (ep === "/payment-requests/req-1") {
        return sampleRequest({ status: "OPEN" });
      }
      if (ep.startsWith("/payment-requests?")) {
        if (!initialDone) {
          initialDone = true;
          return {
            payment_requests: [sampleRequest({ status: "OPEN" })],
            next_cursor: null,
            has_more: false,
          };
        }
        return staleRefresh.promise;
      }
      return {};
    });

    const refreshRef: { current: (() => Promise<void>) | null } = {
      current: null,
    };
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={(fn) => {
            refreshRef.current = fn;
          }}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(refreshRef.current).not.toBeNull());

    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel Request" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm Cancel" })
    );
    await waitFor(() =>
      expect(within(dialog).getByText("Cancelled")).toBeInTheDocument()
    );
    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Cancel Request" })
    ).not.toBeInTheDocument();

    const refreshPromise = refreshRef.current!();
    await act(async () => {
      staleRefresh.resolve({
        payment_requests: [
          sampleRequest({ status: "OPEN", memo: "stale open after cancel" }),
        ],
        next_cursor: null,
        has_more: false,
      });
    });
    await refreshPromise;

    expect(within(dialog).getByText("Cancelled")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Cancel Request" })
    ).not.toBeInTheDocument();
    // List card badge stays cancelled (detail also shows Cancelled).
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("keeps list card and open detail paid when stale refresh returns OPEN after local PAID sync", async () => {
    const paidRefresh = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    const staleOpenRefresh = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    let initialDone = false;
    let refreshCount = 0;

    const paid = sampleRequest({
      status: "PAID",
      paid_at: "2026-07-01T13:00:00Z",
      payment_request: null,
    });

    apiCall.mockImplementation(async (endpoint: string) => {
      const ep = String(endpoint);
      if (ep === "/payment-requests/req-1") {
        return refreshCount === 0
          ? sampleRequest({ status: "OPEN" })
          : paid;
      }
      if (ep.startsWith("/payment-requests?")) {
        if (!initialDone) {
          initialDone = true;
          return {
            payment_requests: [sampleRequest({ status: "OPEN" })],
            next_cursor: null,
            has_more: false,
          };
        }
        refreshCount += 1;
        if (refreshCount === 1) return paidRefresh.promise;
        return staleOpenRefresh.promise;
      }
      return {};
    });

    const refreshRef: { current: (() => Promise<void>) | null } = {
      current: null,
    };
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={(fn) => {
            refreshRef.current = fn;
          }}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(refreshRef.current).not.toBeNull());

    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();

    const paidSyncPromise = refreshRef.current!();
    await act(async () => {
      paidRefresh.resolve({
        payment_requests: [paid],
        next_cursor: null,
        has_more: false,
      });
    });
    await paidSyncPromise;
    await waitFor(() =>
      expect(within(dialog).getByText("Paid")).toBeInTheDocument()
    );
    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();

    const stalePromise = refreshRef.current!();
    await act(async () => {
      staleOpenRefresh.resolve({
        payment_requests: [sampleRequest({ status: "OPEN" })],
        next_cursor: null,
        has_more: false,
      });
    });
    await stalePromise;

    expect(within(dialog).getByText("Paid")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("accepts CANCELLED → PAID and EXPIRED → PAID on refresh", async () => {
    let listRow = sampleRequest({
      status: "CANCELLED",
      cancelled_at: "2026-07-01T13:00:00Z",
      payment_request: null,
    });
    const paidRefresh = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    let initialDone = false;

    apiCall.mockImplementation(async (endpoint: string) => {
      const ep = String(endpoint);
      if (ep === "/payment-requests/req-1") {
        return listRow;
      }
      if (ep.startsWith("/payment-requests?")) {
        if (!initialDone) {
          initialDone = true;
          return {
            payment_requests: [listRow],
            next_cursor: null,
            has_more: false,
          };
        }
        return paidRefresh.promise;
      }
      return {};
    });

    const refreshRef: { current: (() => Promise<void>) | null } = {
      current: null,
    };
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={(fn) => {
            refreshRef.current = fn;
          }}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    await waitFor(() => expect(refreshRef.current).not.toBeNull());

    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Cancelled")).toBeInTheDocument();

    const paid = sampleRequest({
      status: "PAID",
      paid_at: "2026-07-01T14:00:00Z",
      payment_request: null,
      cancelled_at: "2026-07-01T13:00:00Z",
    });
    listRow = paid;
    const refreshPromise = refreshRef.current!();
    await act(async () => {
      paidRefresh.resolve({
        payment_requests: [paid],
        next_cursor: null,
        has_more: false,
      });
    });
    await refreshPromise;

    await waitFor(() =>
      expect(within(dialog).getByText("Paid")).toBeInTheDocument()
    );
    expect(screen.getAllByText("Paid").length).toBeGreaterThanOrEqual(2);

    const expiredRow = sampleRequest({
      public_id: "req-expired",
      memo: "Expired invoice",
      status: "EXPIRED",
      payment_request: null,
    });
    const expiredToPaid = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint).startsWith("/payment-requests?")) {
        return expiredToPaid.promise;
      }
      return {};
    });

    const seedPromise = refreshRef.current!();
    await act(async () => {
      expiredToPaid.resolve({
        payment_requests: [paid, expiredRow],
        next_cursor: null,
        has_more: false,
      });
    });
    await seedPromise;
    expect(await screen.findByText("Expired invoice")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();

    const expiredPaid = sampleRequest({
      public_id: "req-expired",
      memo: "Expired invoice",
      status: "PAID",
      paid_at: "2026-07-01T15:00:00Z",
      payment_request: null,
    });
    const settleExpired = deferred<{
      payment_requests: PaymentRequest[];
      next_cursor: string | null;
      has_more: boolean;
    }>();
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint).startsWith("/payment-requests?")) {
        return settleExpired.promise;
      }
      return {};
    });

    const settlePromise = refreshRef.current!();
    await act(async () => {
      settleExpired.resolve({
        payment_requests: [paid, expiredPaid],
        next_cursor: null,
        has_more: false,
      });
    });
    await settlePromise;

    await waitFor(() => {
      const paidBadges = screen.getAllByText("Paid");
      expect(paidBadges.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
  });
});

describe("RequestCenter autonomous list polling + detail edge cases", () => {
  beforeEach(() => {
    apiCall.mockReset();
    sockets.length = 0;
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  const listCalls = () =>
    apiCall.mock.calls.filter(([ep]) =>
      String(ep).startsWith("/payment-requests?")
    );

  it("autonomously advances OPEN → stale OPEN → PAID without a second WebSocket", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let listHits = 0;
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint).startsWith("/payment-requests?")) {
        listHits += 1;
        if (listHits <= 2) {
          return {
            payment_requests: [sampleRequest({ status: "OPEN" })],
            next_cursor: null,
            has_more: false,
          };
        }
        return {
          payment_requests: [
            sampleRequest({
              status: "PAID",
              paid_at: "2026-07-01T13:00:00Z",
              payment_request: null,
            }),
          ],
          next_cursor: null,
          has_more: false,
        };
      }
      return {};
    });

    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(listHits).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(listHits).toBe(2));
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(screen.getByText("Paid")).toBeInTheDocument());
    expect(listHits).toBe(3);

    const afterPaid = listHits;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 2);
    });
    expect(listHits).toBe(afterPaid);
    expect(sockets.length).toBe(0);
  });

  it("resumes list polling on visibility/focus after pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint).startsWith("/payment-requests?")) {
        return {
          payment_requests: [sampleRequest({ status: "OPEN" })],
          next_cursor: null,
          has_more: false,
        };
      }
      return {};
    });

    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    const afterInitial = listCalls().length;

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
    expect(listCalls().length).toBe(afterInitial);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() =>
      expect(listCalls().length).toBeGreaterThan(afterInitial)
    );
  });

  it("applies local expiry in open detail without QR/cancel while list is OPEN", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    const expiresAt = new Date(Date.now() + 1_500).toISOString();
    const openExpiring = sampleRequest({
      status: "OPEN",
      expires_at: expiresAt,
    });

    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint) === "/payment-requests/req-1") {
        return openExpiring;
      }
      if (String(endpoint).startsWith("/payment-requests?")) {
        return {
          payment_requests: [openExpiring],
          next_cursor: null,
          has_more: false,
        };
      }
      return {};
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LanguageProvider>
        <RequestCenter
          balanceVisible
          onToggleBalanceVisibility={vi.fn()}
          registerRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /View request for 2,500 sats/i })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("local-qr")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel Request" })
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(within(dialog).queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Cancel Request" })
    ).not.toBeInTheDocument();
  });

  it("handles cancel 200 returning CANCELLED", async () => {
    cleanup();
    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payment-requests/req-cancel-200/cancel") {
        return sampleRequest({
          public_id: "req-cancel-200",
          status: "CANCELLED",
          cancelled_at: "2026-07-01T13:00:00Z",
          payment_request: null,
        });
      }
      return sampleRequest({ public_id: "req-cancel-200", status: "OPEN" });
    });

    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-cancel-200"
          balanceVisible
          listRequest={sampleRequest({
            public_id: "req-cancel-200",
            status: "OPEN",
          })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("handles cancel 409 by refreshing to CANCELLED", async () => {
    cleanup();
    let cancelAttempted = false;
    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payment-requests/req-cancel-409/cancel") {
        cancelAttempted = true;
        throw Object.assign(new Error("Conflict"), { status: 409 });
      }
      if (String(endpoint) === "/payment-requests/req-cancel-409") {
        if (cancelAttempted) {
          return sampleRequest({
            public_id: "req-cancel-409",
            status: "CANCELLED",
            cancelled_at: "2026-07-01T13:00:00Z",
            payment_request: null,
          });
        }
        return sampleRequest({ public_id: "req-cancel-409", status: "OPEN" });
      }
      return {};
    });

    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-cancel-409"
          balanceVisible
          listRequest={sampleRequest({
            public_id: "req-cancel-409",
            status: "OPEN",
          })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("handles transient cancel with local uncertainty then OPEN heals", async () => {
    cleanup();
    let cancelAttempted = false;
    let releaseRefresh: (() => void) | undefined;
    let refreshGate: Promise<void> | null = null;
    const onUpdated = vi.fn();
    apiCall.mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payment-requests/req-cancel-503/cancel") {
        cancelAttempted = true;
        refreshGate = new Promise<void>((resolve) => {
          releaseRefresh = () => resolve();
        });
        throw Object.assign(new Error("Service unavailable"), { status: 503 });
      }
      if (String(endpoint) === "/payment-requests/req-cancel-503") {
        if (cancelAttempted && refreshGate) {
          await refreshGate;
        }
        return sampleRequest({ public_id: "req-cancel-503", status: "OPEN" });
      }
      return {};
    });

    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-cancel-503"
          balanceVisible
          listRequest={sampleRequest({
            public_id: "req-cancel-503",
            status: "OPEN",
          })}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Request" }));
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    expect(await screen.findAllByText("Cancelling")).not.toHaveLength(0);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Request" })
    ).not.toBeInTheDocument();
    expect(
      onUpdated.mock.calls.some(
        ([req]) =>
          String((req as PaymentRequest).status).toUpperCase() ===
          "CANCEL_PENDING"
      )
    ).toBe(false);

    const unlockRefresh = releaseRefresh;
    expect(unlockRefresh).toBeDefined();
    unlockRefresh!();
    expect(await screen.findByTestId("local-qr")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Request" })
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows transitional PROVISIONING / CANCEL_PENDING / FAILED without payability", async () => {
    cleanup();
    apiCall.mockResolvedValue(
      sampleRequest({ status: "PROVISIONING", payment_request: null })
    );
    const { rerender } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );
    expect(await screen.findByText("Preparing")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();

    apiCall.mockResolvedValue(
      sampleRequest({ status: "CANCEL_PENDING", payment_request: null })
    );
    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-2"
          balanceVisible
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );
    expect(await screen.findByText("Cancelling")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();

    apiCall.mockResolvedValue(
      sampleRequest({ status: "FAILED", payment_request: null })
    );
    rerender(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-3"
          balanceVisible
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.queryByTestId("local-qr")).not.toBeInTheDocument();
  });

  it("stops detail polling on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let detailHits = 0;
    apiCall.mockImplementation(async (endpoint: string) => {
      if (String(endpoint) === "/payment-requests/req-1") {
        detailHits += 1;
        return sampleRequest({ status: "OPEN" });
      }
      return {};
    });

    const { unmount } = render(
      <LanguageProvider>
        <RequestDetailModal
          publicId="req-1"
          balanceVisible
          listRequest={sampleRequest({ status: "OPEN" })}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await waitFor(() => expect(detailHits).toBeGreaterThanOrEqual(1));
    const afterMount = detailHits;
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_REQUEST_POLL_INTERVAL_MS * 3);
    });
    expect(detailHits).toBe(afterMount);
  });
});
