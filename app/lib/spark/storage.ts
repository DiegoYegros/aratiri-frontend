/**
 * Device-local Spark wallet metadata. Never stores the mnemonic — only public
 * identifiers and UI flags. Survives Aratiri logout.
 */

export const SPARK_WALLET_STORAGE_KEY = "aratiri_spark_wallet_v1";

export interface SparkWalletMeta {
  spark_address: string;
  identity_public_key: string;
  network: string;
  account_index: number;
  backup_verified: boolean;
  privacy_enabled: boolean;
}

/**
 * Normalize a wallet record (localStorage JSON or legacy shapes). Missing
 * identity/address → null (no wallet).
 */
export function parseSparkWalletRecord(value: unknown): SparkWalletMeta | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const identity =
    typeof record.identity_public_key === "string"
      ? record.identity_public_key.trim()
      : "";
  const address =
    typeof record.spark_address === "string"
      ? record.spark_address.trim()
      : "";
  if (!identity || !address) return null;

  const network =
    typeof record.network === "string" && record.network.trim()
      ? record.network.trim()
      : "MAINNET";
  const account_index =
    typeof record.account_index === "number" &&
    Number.isFinite(record.account_index)
      ? record.account_index
      : 1;

  return {
    spark_address: address,
    identity_public_key: identity,
    network,
    account_index,
    backup_verified: Boolean(record.backup_verified),
    privacy_enabled: Boolean(record.privacy_enabled),
  };
}

export function loadSparkWallet(): SparkWalletMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SPARK_WALLET_STORAGE_KEY);
    if (!raw) return null;
    return parseSparkWalletRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist public metadata only — callers must never pass a mnemonic. */
export function saveSparkWallet(meta: SparkWalletMeta): SparkWalletMeta {
  const normalized = parseSparkWalletRecord(meta);
  if (!normalized) {
    throw new Error("Invalid Spark wallet metadata");
  }
  localStorage.setItem(SPARK_WALLET_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function updateSparkWallet(
  patch: Partial<SparkWalletMeta>
): SparkWalletMeta {
  const current = loadSparkWallet();
  if (!current) {
    throw new Error("No Spark wallet is registered");
  }
  return saveSparkWallet({ ...current, ...patch });
}

export function clearSparkWallet(): void {
  localStorage.removeItem(SPARK_WALLET_STORAGE_KEY);
}
