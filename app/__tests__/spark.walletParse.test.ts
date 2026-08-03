import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearSparkWallet,
  loadSparkWallet,
  parseSparkWalletRecord,
  saveSparkWallet,
  SPARK_WALLET_STORAGE_KEY,
  updateSparkWallet,
} from "@/app/lib/spark/storage";

const complete = {
  spark_address: "spark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  identity_public_key: "a".repeat(64),
  network: "MAINNET",
  account_index: 1,
  backup_verified: true,
  privacy_enabled: false,
};

describe("parseSparkWalletRecord", () => {
  it("returns null for empty object", () => {
    expect(parseSparkWalletRecord({})).toBeNull();
  });

  it("returns null when identity_public_key or spark_address is missing/blank", () => {
    expect(
      parseSparkWalletRecord({ ...complete, identity_public_key: undefined })
    ).toBeNull();
    expect(
      parseSparkWalletRecord({ ...complete, identity_public_key: "" })
    ).toBeNull();
    expect(
      parseSparkWalletRecord({ ...complete, identity_public_key: "  " })
    ).toBeNull();
    expect(
      parseSparkWalletRecord({ ...complete, spark_address: "" })
    ).toBeNull();
    expect(
      parseSparkWalletRecord({ ...complete, spark_address: "   " })
    ).toBeNull();
    expect(parseSparkWalletRecord(null)).toBeNull();
    expect(parseSparkWalletRecord(undefined)).toBeNull();
  });

  it("returns a normalized wallet when identity and spark_address are present", () => {
    expect(parseSparkWalletRecord(complete)).toEqual(complete);
  });

  it("defaults network/account_index and coerces flag booleans", () => {
    expect(
      parseSparkWalletRecord({
        spark_address: complete.spark_address,
        identity_public_key: complete.identity_public_key,
      })
    ).toEqual({
      spark_address: complete.spark_address,
      identity_public_key: complete.identity_public_key,
      network: "MAINNET",
      account_index: 1,
      backup_verified: false,
      privacy_enabled: false,
    });
  });
});

describe("spark localStorage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips via saveSparkWallet / loadSparkWallet", () => {
    saveSparkWallet(complete);
    expect(loadSparkWallet()).toEqual(complete);
    expect(localStorage.getItem(SPARK_WALLET_STORAGE_KEY)).toContain(
      complete.spark_address
    );
  });

  it("never persists a mnemonic field even if passed on the object", () => {
    saveSparkWallet({
      ...complete,
      // @ts-expect-error intentional abuse — storage must not keep secrets
      mnemonic: "abandon abandon abandon",
    });
    const raw = localStorage.getItem(SPARK_WALLET_STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/mnemonic|abandon/);
    expect(JSON.parse(raw)).toEqual(complete);
  });

  it("updateSparkWallet patches flags and clearSparkWallet removes the key", () => {
    saveSparkWallet(complete);
    expect(updateSparkWallet({ backup_verified: true, privacy_enabled: true })).toEqual(
      {
        ...complete,
        backup_verified: true,
        privacy_enabled: true,
      }
    );
    clearSparkWallet();
    expect(loadSparkWallet()).toBeNull();
    expect(localStorage.getItem(SPARK_WALLET_STORAGE_KEY)).toBeNull();
  });
});
