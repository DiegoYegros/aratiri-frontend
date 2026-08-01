import { PaymentRequest } from "./api";

export type PaymentRequestStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled";

export const EXPIRY_OPTIONS = [
  { seconds: 3600, labelKey: "1 hour" },
  { seconds: 86400, labelKey: "24 hours" },
  { seconds: 604800, labelKey: "7 days" },
] as const;

export const MIN_EXPIRES_IN_SECONDS = 60;
export const MAX_EXPIRES_IN_SECONDS = 604800;
export const MAX_MEMO_LENGTH = 500;
export const PAYMENT_REQUEST_POLL_INTERVAL_MS = 5000;

export const normalizePaymentRequestStatus = (
  status: string
): PaymentRequestStatus | "unknown" => {
  const normalized = status.toLowerCase();
  // Backend payable state is OPEN; keep PENDING as an alias.
  if (normalized === "open" || normalized === "pending") return "pending";
  if (normalized === "canceled") return "cancelled";
  if (
    normalized === "paid" ||
    normalized === "expired" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "unknown";
};

export const isTerminalPaymentRequestStatus = (
  status: PaymentRequestStatus | "unknown"
): boolean =>
  status === "paid" || status === "expired" || status === "cancelled";

/**
 * Monotonic lifecycle for UI: PAID/CANCELLED/EXPIRED never regress to
 * OPEN/pending from a stale response. PAID is authoritative and may
 * supersede CANCELLED or EXPIRED when settlement wins the race.
 */
export const shouldAcceptPaymentRequestStatusUpdate = (
  currentStatus: string,
  incomingStatus: string
): boolean => {
  const current = normalizePaymentRequestStatus(currentStatus);
  const incoming = normalizePaymentRequestStatus(incomingStatus);

  if (current === incoming) return true;
  if (current === "unknown") return true;
  // PAID never leaves for another status.
  if (current === "paid") return false;
  // Terminal states never regress to OPEN/pending.
  if (incoming === "pending") return false;
  // pending → any other status.
  if (current === "pending") return true;
  // CANCELLED/EXPIRED may advance to PAID.
  if (
    (current === "cancelled" || current === "expired") &&
    incoming === "paid"
  ) {
    return true;
  }
  return false;
};

/** Prefer incoming only when its status does not violate monotonic lifecycle. */
export const mergePaymentRequestMonotonic = (
  current: PaymentRequest,
  incoming: PaymentRequest
): PaymentRequest => {
  if (current.public_id !== incoming.public_id) return incoming;
  if (
    !shouldAcceptPaymentRequestStatusUpdate(current.status, incoming.status)
  ) {
    return current;
  }
  return incoming;
};

/** Apply monotonic merge per public_id when replacing a list from refresh. */
export const mergePaymentRequestListMonotonic = (
  previous: PaymentRequest[],
  incoming: PaymentRequest[]
): PaymentRequest[] => {
  const prevById = new Map(previous.map((r) => [r.public_id, r]));
  return incoming.map((item) => {
    const prev = prevById.get(item.public_id);
    return prev ? mergePaymentRequestMonotonic(prev, item) : item;
  });
};

export const isCancellablePaymentRequest = (
  request: PaymentRequest
): boolean => {
  if (normalizePaymentRequestStatus(request.status) !== "pending") {
    return false;
  }
  if (request.expires_at) {
    const expiresAt = Date.parse(request.expires_at);
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
      return false;
    }
  }
  return true;
};

/** Prefer frontend-origin `/pay/{publicId}`; fall back to backend share_url. */
export const getPaymentRequestShareUrl = (
  publicId: string,
  fallbackShareUrl?: string | null
): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/pay/${publicId}`;
  }
  if (fallbackShareUrl) return fallbackShareUrl;
  return `/pay/${publicId}`;
};

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const isValidAmountSats = (value: string): boolean => {
  if (!/^\d+$/.test(value)) return false;
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0;
};
