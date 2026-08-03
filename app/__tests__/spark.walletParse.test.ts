import { describe, expect, it } from "vitest";
import { parseSparkWallet } from "@/app/lib/api";

const complete = {
  spark_address: "spark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  identity_public_key: "a".repeat(64),
  network: "MAINNET",
  account_index: 1,
  backup_verified: true,
  privacy_enabled: false,
};

describe("parseSparkWallet", () => {
  it("returns null for empty object (apiCall empty-body path)", () => {
    expect(parseSparkWallet({})).toBeNull();
  });

  it("returns null when identity_public_key or spark_address is missing/blank", () => {
    expect(
      parseSparkWallet({ ...complete, identity_public_key: undefined })
    ).toBeNull();
    expect(parseSparkWallet({ ...complete, identity_public_key: "" })).toBeNull();
    expect(parseSparkWallet({ ...complete, identity_public_key: "  " })).toBeNull();
    expect(parseSparkWallet({ ...complete, spark_address: "" })).toBeNull();
    expect(parseSparkWallet({ ...complete, spark_address: "   " })).toBeNull();
    expect(parseSparkWallet(null)).toBeNull();
    expect(parseSparkWallet(undefined)).toBeNull();
  });

  it("returns the wallet when identity and spark_address are present", () => {
    expect(parseSparkWallet(complete)).toEqual(complete);
  });
});
