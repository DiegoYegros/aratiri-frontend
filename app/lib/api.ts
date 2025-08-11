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

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "success" | "error";
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://aratiri.diegoyegros.com/v1";

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
  const originalRequest = { endpoint, options };
  let token = localStorage.getItem("aratiri_accessToken");

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
      throw new Error(errorData.message || `HTTP Error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return {};
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
};
