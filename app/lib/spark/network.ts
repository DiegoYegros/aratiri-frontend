"use client";

import { WalletConfig } from "@buildonspark/spark-sdk";

/**
 * The Spark network the frontend initializes wallets against. The backend is
 * metadata-only; balances and history are read browser-side via the SDK.
 * REGTEST and MAINNET share the SSP host (api.lightspark.com) and are
 * distinguished by the SSP identity key + signing-operator set, so the wrong
 * config silently points at the wrong ledger — this must match the backend's
 * SparkNetwork for the deployment.
 */
export const SPARK_NETWORK: "MAINNET" | "REGTEST" =
  process.env.NEXT_PUBLIC_SPARK_NETWORK === "REGTEST" ? "REGTEST" : "MAINNET";

/** Full SDK config preset for the selected network. */
export const SPARK_CONFIG = WalletConfig[SPARK_NETWORK];

/**
 * Account number passed explicitly to the SDK (default differs per network —
 * REGTEST=0, MAINNET=1). Always passing it avoids the off-by-one gotcha.
 */
export const SPARK_ACCOUNT_INDEX = SPARK_NETWORK === "REGTEST" ? 0 : 1;
