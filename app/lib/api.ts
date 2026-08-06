export interface Account {
  id: string;
  balance: number;
  alias: string;
  lnurl: string;
  lnurl_qr_code: string;
  bitcoin_address: string;
  bitcoin_address_qr_code: string;
  fiat_equivalents: {
    [key: string]: number;
  };
}

export interface Transaction {
  id: string;
  type:
    | "LIGHTNING_DEBIT"
    | "LIGHTNING_CREDIT"
    | "ONCHAIN_DEBIT"
    | "ONCHAIN_CREDIT"
    | "INVOICE_CREDIT"
    | "INVOICE_DEBIT"
    | "INTERNAL_TRANSFER_CREDIT"
    | "INTERNAL_TRANSFER_DEBIT"
    | "CREDIT"
    | "DEBIT";
  amount: number;
  date: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  fiat_equivalents: {
    [key: string]: number;
  };
}

export interface DecodedInvoice {
  destination: string;
  payment_hash: string;
  num_satoshis: number;
  description: string;
  expiry: number;
}

export interface LnurlParams {
  tag: string;
  status: string;
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  commentAllowed?: number;
}

export interface DecodedResponse {
  type:
    | "lightning_invoice"
    | "lnurl_params"
    | "bitcoin_address"
    | "alias"
    | "spark_address"
    | "error";
  data: DecodedInvoice | LnurlParams | string | null;
  error?: string;
}
export interface EstimateFeeResponse {
  fee_sat: number;
  sat_per_vbyte: number;
}

export interface CurrentBtcPrice {
  currency: string;
  price: number;
  updatedAt: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "success" | "error";
}

/** Owner / public payment-request DTO (snake_case from API). */
export interface PaymentRequest {
  public_id: string;
  share_url: string;
  amount_sats: number;
  memo: string | null;
  status: string;
  payment_request: string | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
}

export interface PaymentRequestListResponse {
  payment_requests: PaymentRequest[];
  next_cursor: string | null;
  has_more: boolean;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://aratiri.diegoyegros.com/v1";

/** Fixed subprotocol for notification WebSocket handshake (never put tickets in the URL). */
export const NOTIFICATIONS_WS_SUBPROTOCOL = "aratiri.notifications.v1";

export interface NotificationWsTicket {
  ticket: string;
  expiresInSeconds: number;
  expiresAt: string;
}

/** Derive backend root by removing a trailing `/v1` only. */
export const getBackendRootUrl = (apiBaseUrl: string = API_BASE_URL): string =>
  apiBaseUrl.replace(/\/v1\/?$/, "");

/**
 * Public payment-request fetch at backend-root `/r/{publicId}`.
 * Does not use apiCall (avoids attaching Authorization).
 */
export const fetchPublicPaymentRequest = async (
  publicId: string
): Promise<PaymentRequest> => {
  const response = await fetch(
    `${getBackendRootUrl()}/r/${encodeURIComponent(publicId)}`
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "An unknown error occurred." }));
    const error = new Error(
      errorData.message || `HTTP Error: ${response.status}`
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
};

/**
 * Unauthenticated GET against the API base. Never attaches Authorization and
 * never force-logouts — safe for guest Spark sessions (btc price, currencies).
 */
export const publicApiGet = async <T = unknown>(endpoint: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "An unknown error occurred." }));
    const error = new Error(
      errorData.message || `HTTP Error: ${response.status}`
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return {} as T;
};

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const forceLogout = () => {
  localStorage.removeItem("aratiri_accessToken");
  localStorage.removeItem("aratiri_refreshToken");
  window.dispatchEvent(new Event("force-logout"));
};

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("aratiri_accessToken");

  const headers = new Headers(options.headers || {});
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              headers.set("Authorization", `Bearer ${newToken}`);
              return fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
              });
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        isRefreshing = true;
        const refreshToken = localStorage.getItem("aratiri_refreshToken");
        if (!refreshToken) {
          forceLogout();
          return Promise.reject(new Error("Session expired."));
        }

        return fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refreshToken }),
        })
          .then((res) => res.json())
          .then((tokens) => {
            if (!tokens.accessToken)
              throw new Error("Failed to refresh token.");
            localStorage.setItem("aratiri_accessToken", tokens.accessToken);
            localStorage.setItem("aratiri_refreshToken", tokens.refreshToken);
            processQueue(null, tokens.accessToken);
            headers.set("Authorization", `Bearer ${tokens.accessToken}`);
            return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
          })
          .catch((err) => {
            processQueue(err, null);
            forceLogout();
            return Promise.reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      }

      const errorData = await response
        .json()
        .catch(() => ({ message: "An unknown error occurred." }));
      const error = new Error(
        errorData.message || `HTTP Error: ${response.status}`
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return {};
  } catch (error) {
    throw error;
  }
};

/** Mint a short-lived single-use ticket for the notifications WebSocket. */
export const mintNotificationWsTicket =
  async (): Promise<NotificationWsTicket> => {
    return apiCall("/notifications/ws-ticket", { method: "POST" });
  };
