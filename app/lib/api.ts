export interface Account {
  id: string;
  balance: number;
  alias: string;
  lnurl: string;
  qr_code: string;
}

export interface Transaction {
  id: string;
  type:
    | "INVOICE_CREDIT"
    | "LN_PAYMENT_DEBIT"
    | "ONCHAIN_DEPOSIT"
    | "INTERNAL_TRANSFER_CREDIT"
    | "INVOICE_DEBIT"
    | "INTERNAL_TRANSFER_DEBIT";
  amount: number;
  date: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
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

//export const API_BASE_URL = "https://aratiri.diegoyegros.com/v1";
export const API_BASE_URL = "http://localhost:2100/v1";

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("aratiri_token");
  const headers = new Headers(options.headers || {});

  if (
    options.body &&
    typeof options.body === "string" &&
    options.body.startsWith("ey")
  ) {
    headers.set("Content-Type", "text/plain");
  } else if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "An unknown error occurred." }));
    throw new Error(errorData.message || `HTTP Error: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  }
  return {};
};
