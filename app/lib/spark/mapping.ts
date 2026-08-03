/**
 * Shared mapping between the Spark SDK's transfer shapes and the dashboard's
 * row model. Used by SparkProvider (unlocked WalletTransfer + locked readonly
 * proto Transfer) and by TransactionsTab for rendering.
 */

export type SparkTransferKind =
  | "spark"
  | "lightning"
  | "withdrawal"
  | "deposit";

export interface SparkTransferRow {
  id: string;
  kind: SparkTransferKind;
  direction: "in" | "out";
  amountSats: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdTime: Date | null;
}

/**
 * Shape-union of the two SDK transfer objects we map. The unlocked path yields
 * `WalletTransfer` (string status/type/transferDirection, userRequest), the
 * locked readonly path yields the gRPC `Transfer` (numeric status/type,
 * Uint8Array identity keys, no userRequest).
 */
export interface SparkTransferLike {
  id: string;
  status: string | number;
  totalValue: number;
  createdTime?: Date | undefined;
  type: string | number;
  transferDirection?: string | undefined;
  senderIdentityPublicKey?: string | Uint8Array;
  receivers?: Array<{ identityPublicKey: string | Uint8Array }>;
  userRequest?: { typename?: string } | undefined;
}

const STATUS_COMPLETED = /(COMPLETED|SUCCEEDED)$/i;
const STATUS_FAILED = /(EXPIRED|RETURNED|CANCELLED|FAILED|ERROR)/i;

export const toRowStatus = (
  status: string | number
): SparkTransferRow["status"] => {
  if (typeof status === "number") {
    if (status === 5) return "COMPLETED";
    if (status === 6 || status === 7) return "FAILED";
    return "PENDING";
  }
  if (STATUS_COMPLETED.test(status)) return "COMPLETED";
  if (STATUS_FAILED.test(status)) return "FAILED";
  return "PENDING";
};

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/**
 * gRPC `TransferType` numeric ids (readonly/query_all_transfers path):
 * 0 = PREIMAGE_SWAP (lightning), 1 = COOPERATIVE_EXIT (withdrawal),
 * 2 = TRANSFER (spark); 3/4/5/30/40 are swap side-effects — shown as spark.
 */
const NUMERIC_KIND: Record<number, SparkTransferKind> = {
  0: "lightning",
  1: "withdrawal",
  2: "spark",
};

export const kindFromTransfer = (t: SparkTransferLike): SparkTransferKind => {
  if (typeof t.type === "number") {
    return NUMERIC_KIND[t.type] ?? "spark";
  }
  if (String(t.type).includes("PREIMAGE")) return "lightning";
  if (String(t.type).includes("COOPERATIVE_EXIT")) return "withdrawal";
  const typename = t.userRequest?.typename ?? "";
  if (typename.includes("CoopExit")) return "withdrawal";
  if (typename.includes("Lightning")) return "lightning";
  return "spark";
};

/**
 * Maps SDK transfers to the dashboard row model. Direction uses the
 * authoritative transferDirection when present (unlocked); otherwise infers
 * from the receivers list against the wallet's own identity public key.
 */
export const toTransferRows = (
  transfers: SparkTransferLike[],
  ownIdentityHex?: string
): SparkTransferRow[] =>
  transfers.map((t) => {
    const ownHex = ownIdentityHex?.toLowerCase();
    const hasDirection = typeof t.transferDirection === "string";
    const direction: "in" | "out" = hasDirection
      ? t.transferDirection === "INCOMING"
        ? "in"
        : "out"
      : ownHex &&
          t.receivers?.some((r) => {
            const key =
              typeof r.identityPublicKey === "string"
                ? r.identityPublicKey
                : toHex(r.identityPublicKey as Uint8Array);
            return key.toLowerCase() === ownHex;
          })
        ? "in"
        : "out";
    return {
      id: t.id,
      kind: kindFromTransfer(t),
      direction,
      amountSats: t.totalValue,
      status: toRowStatus(t.status),
      createdTime: t.createdTime ?? null,
    };
  });

/** Terminal states for the async outgoing Lightning send poll. */
export const isLightningSendTerminal = (status: string): boolean => {
  if (status.includes("FAILED") || status === "FUTURE_VALUE") return true;
  return (
    status === "LIGHTNING_PAYMENT_SUCCEEDED" ||
    status === "PREIMAGE_PROVIDED" ||
    status === "TRANSFER_COMPLETED"
  );
};

/** Terminal states for the async coop-exit withdrawal poll. */
export const isCoopExitTerminal = (status: string): boolean =>
  status === "SUCCEEDED" || status === "EXPIRED" || status === "FAILED";

/**
 * The SDK hard-fails when the device clock is >2 min off (signature
 * timestamp / invoice expiry validation). Surface that clearly instead of
 * the raw error.
 */
export const describeSparkError = (
  err: unknown,
  fallback: string,
  clockMessage: string
): string => {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/expiry_time|clock skew|device clock|invalid.*expiry/i.test(message)) {
    return clockMessage;
  }
  return message || fallback;
};
