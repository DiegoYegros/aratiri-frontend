import { describe, expect, it, vi } from "vitest";
import { isSparkAddress, normalizeSparkAddress } from "@/app/lib/spark/address";
import { fetchLnurlBolt11 } from "@/app/lib/spark/lnurl";
import { sparkWithdrawSpendSats } from "@/app/lib/spark/withdraw";

const SAMPLE_SPARK =
  "spark1pgssyele0qrcjdheeq2a0zmpwdwvj3r4f4stkuju0fp36g6grapv2w7l8am2cp";

describe("spark address helpers", () => {
  it("accepts Spark Bech32m prefixes and normalizes case", () => {
    expect(isSparkAddress(SAMPLE_SPARK)).toBe(true);
    expect(
      isSparkAddress(
        "sparkrt1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"
      )
    ).toBe(true);
    expect(isSparkAddress("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh")).toBe(
      false
    );
    expect(normalizeSparkAddress(`  ${SAMPLE_SPARK.toUpperCase()}  `)).toBe(
      SAMPLE_SPARK
    );
  });
});

describe("sparkWithdrawSpendSats", () => {
  it("defaults to fee-deducted spend (amount only)", () => {
    expect(sparkWithdrawSpendSats(50_000, 1_200, true)).toBe(50_000);
    expect(sparkWithdrawSpendSats(50_000, 1_200, false)).toBe(51_200);
  });
});

describe("fetchLnurlBolt11", () => {
  it("reads pr from the callback JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pr: "lnbc99" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchLnurlBolt11({
        callback: "https://cb.example/pay",
        amountMsat: 1000,
        comment: "hi",
      })
    ).resolves.toBe("lnbc99");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("amount=1000");
    expect(calledUrl).toContain("comment=hi");
    vi.unstubAllGlobals();
  });
});
