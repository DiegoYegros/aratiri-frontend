import { PaymentRequest } from "./api";

/**
 * Normalized durable saga statuses (+ effective EXPIRED from local clock).
 * Legacy PENDING aliases OPEN; legacy CANCELED aliases CANCELLED.
 */
export type PaymentRequestStatus =
  | "provisioning"
  | "open"
  | "cancel_pending"
  | "cancelled"
  | "paid"
  | "failed"
  | "expired";

export const EXPIRY_OPTIONS = [
  { seconds: 3600, labelKey: "1 hour" },
  { seconds: 86400, labelKey: "24 hours" },
  { seconds: 604800, labelKey: "7 days" },
] as const;

export const MIN_EXPIRES_IN_SECONDS = 60;
export const MAX_EXPIRES_IN_SECONDS = 604800;
export const MAX_MEMO_LENGTH = 500;

/**
 * Base active poll interval while OPEN / PROVISIONING / CANCEL_PENDING
 * during the fast window (~2–5s band). Kept as the primary tick for tests.
 */
export const PAYMENT_REQUEST_POLL_INTERVAL_MS = 5000;

/** First window of active polling before backing off toward 30s. */
export const PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS = 120_000;

/** Maximum visible active poll interval after the fast window. */
export const PAYMENT_REQUEST_VISIBLE_POLL_MAX_MS = 30_000;

/**
 * Low-frequency poll while CANCELLED / EXPIRED / FAILED may still settle to PAID.
 */
export const PAYMENT_REQUEST_TERMINAL_RECONCILE_INTERVAL_MS = 15_000;

/**
 * Bounded late-settlement window for terminal reconciliation.
 * Stops after this elapsed time from first observing a terminal-reconcilable
 * status (unless PAID arrives or the view unmounts). Focus/reconnect/manual
 * refresh still refetch.
 */
export const PAYMENT_REQUEST_TERMINAL_RECONCILE_WINDOW_MS = 120_000;

/** Transient list/detail poll failure backoff (reset on success). */
export const PAYMENT_REQUEST_BACKOFF_INITIAL_MS = 5_000;
export const PAYMENT_REQUEST_BACKOFF_MAX_MS = 30_000;
export const PAYMENT_REQUEST_BACKOFF_FACTOR = 2;

/**
 * Public /pay/[id] initial+refresh 404 recovery budget against rollout /
 * projection skew. Exhaustion yields not-found or an explicit Retry.
 */
export const PUBLIC_PAYMENT_REQUEST_404_RETRY_LIMIT = 3;
export const PUBLIC_PAYMENT_REQUEST_404_RETRY_DELAY_MS = 1_000;

const STATUS_RANK: Record<PaymentRequestStatus, number> = {
  provisioning: 1,
  open: 2,
  cancel_pending: 3,
  cancelled: 4,
  expired: 4,
  failed: 4,
  paid: 5,
};

export const normalizePaymentRequestStatus = (
  status: string
): PaymentRequestStatus | "unknown" => {
  const normalized = status.toLowerCase().replace(/-/g, "_");
  if (normalized === "open" || normalized === "pending") return "open";
  if (normalized === "provisioning") return "provisioning";
  if (normalized === "cancel_pending") return "cancel_pending";
  if (normalized === "canceled" || normalized === "cancelled") {
    return "cancelled";
  }
  if (normalized === "paid") return "paid";
  if (normalized === "failed") return "failed";
  if (normalized === "expired") return "expired";
  return "unknown";
};

/** Parse expires_at; invalid/missing → null (not locally expired). */
export const getPaymentRequestExpiresAtMs = (
  request: Pick<PaymentRequest, "expires_at">
): number | null => {
  if (!request.expires_at) return null;
  const ms = Date.parse(request.expires_at);
  return Number.isNaN(ms) ? null : ms;
};

/** Local clock crossed a valid expires_at (safety boundary only). */
export const isPaymentRequestLocallyExpired = (
  request: Pick<PaymentRequest, "expires_at">,
  nowMs: number = Date.now()
): boolean => {
  const expiresAt = getPaymentRequestExpiresAtMs(request);
  return expiresAt !== null && expiresAt <= nowMs;
};

/**
 * Display/effective status: applies local expiry to OPEN without mutating DTO.
 * Authoritative backend status is unchanged.
 */
export const getEffectivePaymentRequestStatus = (
  request: Pick<PaymentRequest, "status" | "expires_at">,
  nowMs: number = Date.now()
): PaymentRequestStatus | "unknown" => {
  const raw = normalizePaymentRequestStatus(request.status);
  if (raw === "open" && isPaymentRequestLocallyExpired(request, nowMs)) {
    return "expired";
  }
  return raw;
};

export const isTerminalPaymentRequestStatus = (
  status: PaymentRequestStatus | "unknown"
): boolean =>
  status === "paid" ||
  status === "expired" ||
  status === "cancelled" ||
  status === "failed";

/** Only PAID is fully final (no further autonomous reconciliation). */
export const isFinalPaymentRequestStatus = (
  status: PaymentRequestStatus | "unknown"
): boolean => status === "paid";

/** OPEN / PROVISIONING / CANCEL_PENDING — normal-frequency polling. */
export const isActiveReconcilableStatus = (
  status: PaymentRequestStatus | "unknown"
): boolean =>
  status === "open" ||
  status === "provisioning" ||
  status === "cancel_pending";

/**
 * CANCELLED / EXPIRED / FAILED — bounded low-frequency late-settlement polls
 * (PAID may still win).
 */
export const isTerminalReconcilableStatus = (
  status: PaymentRequestStatus | "unknown"
): boolean =>
  status === "cancelled" || status === "expired" || status === "failed";

export const needsPaymentRequestReconciliation = (
  request: Pick<PaymentRequest, "status" | "expires_at">,
  nowMs: number = Date.now()
): boolean => {
  const effective = getEffectivePaymentRequestStatus(request, nowMs);
  if (isFinalPaymentRequestStatus(effective) || effective === "unknown") {
    return false;
  }
  return (
    isActiveReconcilableStatus(effective) ||
    isTerminalReconcilableStatus(effective)
  );
};

/**
 * Next delay for active (non-terminal) polling based on elapsed visible time.
 * ~POLL_INTERVAL for the first 2 minutes, then backs off toward 30s.
 */
export const getActivePaymentRequestPollIntervalMs = (
  elapsedVisibleMs: number
): number => {
  if (elapsedVisibleMs < PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS) {
    return PAYMENT_REQUEST_POLL_INTERVAL_MS;
  }
  const over = elapsedVisibleMs - PAYMENT_REQUEST_ACTIVE_FAST_WINDOW_MS;
  const steps = Math.floor(over / PAYMENT_REQUEST_POLL_INTERVAL_MS);
  const interval =
    PAYMENT_REQUEST_POLL_INTERVAL_MS * Math.pow(1.5, Math.max(0, steps));
  return Math.min(
    PAYMENT_REQUEST_VISIBLE_POLL_MAX_MS,
    Math.round(interval)
  );
};

export const getNextPaymentRequestBackoffMs = (
  previousBackoffMs: number | null
): number => {
  if (previousBackoffMs === null || previousBackoffMs <= 0) {
    return PAYMENT_REQUEST_BACKOFF_INITIAL_MS;
  }
  return Math.min(
    PAYMENT_REQUEST_BACKOFF_MAX_MS,
    Math.round(previousBackoffMs * PAYMENT_REQUEST_BACKOFF_FACTOR)
  );
};

/**
 * Monotonic lifecycle: PAID is authoritative/final and may supersede any prior
 * state. Stale OPEN/PROVISIONING/CANCELLED/EXPIRED/FAILED must not overwrite PAID.
 * Transitional states never regress to earlier in-progress states.
 */
export const shouldAcceptPaymentRequestStatusUpdate = (
  currentStatus: string,
  incomingStatus: string
): boolean => {
  const current = normalizePaymentRequestStatus(currentStatus);
  const incoming = normalizePaymentRequestStatus(incomingStatus);

  if (current === incoming) return true;
  if (current === "unknown") return true;
  if (current === "paid") return false;
  if (incoming === "paid") return true;
  if (incoming === "unknown") return false;

  if (current === "cancel_pending") {
    if (incoming === "open" || incoming === "provisioning") return false;
  }
  if (current === "open" && incoming === "provisioning") return false;

  if (isTerminalPaymentRequestStatus(current)) {
    // Terminal peers do not swap; only PAID (handled above) advances.
    return false;
  }

  return STATUS_RANK[incoming] >= STATUS_RANK[current];
};

/** Strip BOLT11 on every non-OPEN normalized status (never restore payability). */
export const clearPaymentRequestInvoiceIfNotOpen = (
  request: PaymentRequest
): PaymentRequest => {
  if (normalizePaymentRequestStatus(request.status) === "open") {
    return request;
  }
  if (request.payment_request == null) return request;
  return { ...request, payment_request: null };
};

/** Prefer incoming only when its status does not violate monotonic lifecycle. */
export const mergePaymentRequestMonotonic = (
  current: PaymentRequest,
  incoming: PaymentRequest
): PaymentRequest => {
  if (current.public_id !== incoming.public_id) {
    return clearPaymentRequestInvoiceIfNotOpen(incoming);
  }
  if (
    !shouldAcceptPaymentRequestStatusUpdate(current.status, incoming.status)
  ) {
    return current;
  }
  return clearPaymentRequestInvoiceIfNotOpen(incoming);
};

/** Apply monotonic merge per public_id when replacing a list from refresh. */
export const mergePaymentRequestListMonotonic = (
  previous: PaymentRequest[],
  incoming: PaymentRequest[]
): PaymentRequest[] => {
  const prevById = new Map(previous.map((r) => [r.public_id, r]));
  return incoming.map((item) => {
    const prev = prevById.get(item.public_id);
    return prev ? mergePaymentRequestMonotonic(prev, item) : clearPaymentRequestInvoiceIfNotOpen(item);
  });
};

/** True when raw lifecycle is OPEN and client clock has not crossed expires_at. */
export const isOpenAndNotLocallyExpired = (
  request: Pick<PaymentRequest, "status" | "expires_at">,
  nowMs: number = Date.now()
): boolean =>
  normalizePaymentRequestStatus(request.status) === "open" &&
  !isPaymentRequestLocallyExpired(request, nowMs);

/** Invoice QR / copy / open-wallet: OPEN, not locally expired, bolt11 present. */
export const isPayablePaymentRequest = (
  request: PaymentRequest,
  nowMs: number = Date.now()
): boolean =>
  isOpenAndNotLocallyExpired(request, nowMs) &&
  Boolean(request.payment_request);

/** Cancel control: OPEN and not locally expired. */
export const isCancellablePaymentRequest = (
  request: PaymentRequest,
  nowMs: number = Date.now()
): boolean => isOpenAndNotLocallyExpired(request, nowMs);

/**
 * Max delay passed to setTimeout. Delays above 2^31-1 overflow the signed
 * 32-bit timer and can fire immediately, spinning expiry schedulers.
 */
export const PAYMENT_REQUEST_MAX_TIMER_MS = 2_147_483_647;

/**
 * ms until local expiry for OPEN requests with a valid expires_at; null if N/A
 * or already locally expired. Callers must only schedule when the value is > 0
 * (and should clamp with PAYMENT_REQUEST_MAX_TIMER_MS).
 */
export const getMsUntilPaymentRequestLocalExpiry = (
  request: Pick<PaymentRequest, "status" | "expires_at">,
  nowMs: number = Date.now()
): number | null => {
  if (normalizePaymentRequestStatus(request.status) !== "open") return null;
  const expiresAt = getPaymentRequestExpiresAtMs(request);
  if (expiresAt === null) return null;
  const delta = expiresAt - nowMs;
  return delta > 0 ? delta : null;
};

/** i18n label keys for normalized/effective statuses. */
export const paymentRequestStatusLabelKey: Record<
  PaymentRequestStatus,
  string
> = {
  provisioning: "Preparing",
  open: "Pending",
  cancel_pending: "Cancelling",
  cancelled: "Cancelled",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
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

export const getErrorStatus = (err: unknown): number | undefined => {
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
};

/** Network failures, 429, and 5xx are transient. */
export const isTransientPaymentRequestError = (err: unknown): boolean => {
  const status = getErrorStatus(err);
  if (status === undefined) return true;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
};
