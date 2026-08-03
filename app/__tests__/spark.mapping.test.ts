import { describe, expect, it } from "vitest";
import {
  describeSparkError,
  isCoopExitTerminal,
  isLightningSendTerminal,
  kindFromTransfer,
  toHex,
  toRowStatus,
  toTransferRows,
  type SparkTransferLike,
} from "@/app/lib/spark/mapping";

const transfer = (
  overrides: Partial<SparkTransferLike> = {}
): SparkTransferLike => ({
  id: "t1",
  status: "PENDING",
  totalValue: 1000,
  type: "TRANSFER",
  transferDirection: "INCOMING",
  ...overrides,
});

describe("toRowStatus", () => {
  it("maps numeric proto statuses (5 completed, 6/7 failed)", () => {
    expect(toRowStatus(5)).toBe("COMPLETED");
    expect(toRowStatus(6)).toBe("FAILED");
    expect(toRowStatus(7)).toBe("FAILED");
    expect(toRowStatus(0)).toBe("PENDING");
    expect(toRowStatus(4)).toBe("PENDING");
  });

  it("maps string statuses including SDK terminal success strings", () => {
    expect(toRowStatus("TRANSFER_COMPLETED")).toBe("COMPLETED");
    expect(toRowStatus("LIGHTNING_PAYMENT_SUCCEEDED")).toBe("COMPLETED");
    expect(toRowStatus("SUCCEEDED")).toBe("COMPLETED");
    expect(toRowStatus("TRANSFER_FAILED")).toBe("FAILED");
    expect(toRowStatus("TRANSFER_CREATION_FAILED")).toBe("FAILED");
    expect(toRowStatus("LIGHTNING_PAYMENT_FAILED")).toBe("FAILED");
    expect(toRowStatus("USER_SWAP_RETURNED")).toBe("FAILED");
    expect(toRowStatus("EXPIRED")).toBe("FAILED");
    expect(toRowStatus("CANCELLED")).toBe("FAILED");
    expect(toRowStatus("PENDING")).toBe("PENDING");
    expect(toRowStatus("FUTURE_VALUE")).toBe("PENDING");
    expect(toRowStatus("weird")).toBe("PENDING");
  });
});

describe("kindFromTransfer", () => {
  it("maps numeric proto types (0 lightning, 1 coop-exit, 2 spark)", () => {
    expect(kindFromTransfer(transfer({ type: 0 }))).toBe("lightning");
    expect(kindFromTransfer(transfer({ type: 1 }))).toBe("withdrawal");
    expect(kindFromTransfer(transfer({ type: 2 }))).toBe("spark");
    expect(kindFromTransfer(transfer({ type: 30 }))).toBe("spark");
  });

  it("maps string types and userRequest typenames", () => {
    expect(kindFromTransfer(transfer({ type: "PREIMAGE_SWAP" }))).toBe(
      "lightning"
    );
    expect(kindFromTransfer(transfer({ type: "COOPERATIVE_EXIT" }))).toBe(
      "withdrawal"
    );
    expect(
      kindFromTransfer(
        transfer({
          type: "TRANSFER",
          userRequest: { typename: "CoopExitRequest" },
        })
      )
    ).toBe("withdrawal");
    expect(
      kindFromTransfer(
        transfer({
          type: "TRANSFER",
          userRequest: { typename: "LightningSendRequest" },
        })
      )
    ).toBe("lightning");
    expect(kindFromTransfer(transfer({ type: "TRANSFER" }))).toBe("spark");
  });
});

describe("toHex", () => {
  it("hex-encodes bytes little-endian order preserved", () => {
    expect(toHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
    expect(toHex(new Uint8Array([0x00, 0x0a, 0xff]))).toBe("000aff");
    expect(toHex(new Uint8Array([]))).toBe("");
  });
});

describe("toTransferRows", () => {
  it("honors the authoritative transferDirection when present", () => {
    const rows = toTransferRows([
      transfer({ transferDirection: "INCOMING" }),
      transfer({ id: "t2", transferDirection: "OUTGOING" }),
    ]);
    expect(rows[0].direction).toBe("in");
    expect(rows[1].direction).toBe("out");
  });

  it("infers direction from the receivers list against own identity", () => {
    const ownHex = "abcd".padEnd(64, "0");
    const rows = toTransferRows(
      [
        transfer({
          id: "in",
          transferDirection: undefined,
          receivers: [{ identityPublicKey: ownHex }],
        }),
        transfer({
          id: "out",
          transferDirection: undefined,
          receivers: [{ identityPublicKey: "dead".padEnd(64, "0") }],
        }),
      ],
      ownHex
    );
    expect(rows[0].direction).toBe("in");
    expect(rows[1].direction).toBe("out");
  });

  it("handles Uint8Array identity keys via toHex", () => {
    const ownHex = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
    const rows = toTransferRows(
      [
        transfer({
          id: "in",
          transferDirection: undefined,
          receivers: [
            {
              identityPublicKey: new Uint8Array(
                Array.from({ length: 32 }, (_, i) => i)
              ),
            },
          ],
        }),
      ],
      ownHex
    );
    expect(rows[0].direction).toBe("in");
  });

  it("maps amounts, status, and createdTime", () => {
    const created = new Date("2026-08-01T00:00:00Z");
    const rows = toTransferRows([
      transfer({ totalValue: 50000, status: "TRANSFER_COMPLETED", createdTime: created }),
    ]);
    expect(rows[0].amountSats).toBe(50000);
    expect(rows[0].status).toBe("COMPLETED");
    expect(rows[0].createdTime).toBe(created);
    expect(rows[0].kind).toBe("spark");
  });
});

describe("async outgoing poll terminal helpers", () => {
  it("treats success and failure as terminal for lightning sends", () => {
    expect(isLightningSendTerminal("LIGHTNING_PAYMENT_SUCCEEDED")).toBe(true);
    expect(isLightningSendTerminal("PREIMAGE_PROVIDED")).toBe(true);
    expect(isLightningSendTerminal("TRANSFER_COMPLETED")).toBe(true);
    expect(isLightningSendTerminal("LIGHTNING_PAYMENT_FAILED")).toBe(true);
    expect(isLightningSendTerminal("FUTURE_VALUE")).toBe(true);
    expect(isLightningSendTerminal("PENDING")).toBe(false);
    expect(isLightningSendTerminal("PROCESSING")).toBe(false);
  });

  it("treats SUCCEEDED/EXPIRED/FAILED as terminal for coop-exit withdrawals", () => {
    expect(isCoopExitTerminal("SUCCEEDED")).toBe(true);
    expect(isCoopExitTerminal("EXPIRED")).toBe(true);
    expect(isCoopExitTerminal("FAILED")).toBe(true);
    expect(isCoopExitTerminal("PENDING")).toBe(false);
    expect(isCoopExitTerminal("PROCESSING")).toBe(false);
  });
});

describe("describeSparkError", () => {
  const clockMessage =
    "Your device clock looks wrong. Check that the time and timezone are correct.";

  it("surfaces the clock hint for expiry / clock-skew errors", () => {
    expect(
      describeSparkError(
        new Error("invalid expiry_time: device clock skew detected"),
        "fallback",
        clockMessage
      )
    ).toBe(clockMessage);
    expect(
      describeSparkError(new Error("clock skew"), "fallback", clockMessage)
    ).toBe(clockMessage);
    expect(
      describeSparkError(
        new Error("Invalid invoice expiry"),
        "fallback",
        clockMessage
      )
    ).toBe(clockMessage);
  });

  it("falls back to the raw message, then the fallback string", () => {
    expect(describeSparkError(new Error("boom"), "fallback", clockMessage)).toBe(
      "boom"
    );
    expect(describeSparkError(undefined, "fallback", clockMessage)).toBe(
      "fallback"
    );
    expect(describeSparkError(null, "fallback", clockMessage)).toBe("fallback");
  });

  it("maps already-registered / identity-taken conflicts to device-scoped English", () => {
    expect(
      describeSparkError(
        new Error("A Spark wallet is already registered for this user"),
        "fallback",
        clockMessage
      )
    ).toBe("A Spark wallet is already set up on this device.");
    expect(
      describeSparkError(
        new Error(
          "This identity public key is already registered to another user"
        ),
        "fallback",
        clockMessage
      )
    ).toBe("This recovery phrase is already linked on this device.");
    expect(
      describeSparkError(
        new Error("spark identity taken"),
        "fallback",
        clockMessage
      )
    ).toBe("This recovery phrase is already linked on this device.");
  });

  it("does not remap bare/generic HTTP 409s used by payment paths", () => {
    expect(
      describeSparkError(new Error("HTTP Error: 409"), "fallback", clockMessage)
    ).toBe("HTTP Error: 409");
    expect(
      describeSparkError(
        Object.assign(new Error("Conflict"), { status: 409 }),
        "fallback",
        clockMessage
      )
    ).toBe("Conflict");
    expect(
      describeSparkError(
        new Error("UTXO conflict while building transfer"),
        "fallback",
        clockMessage
      )
    ).toBe("UTXO conflict while building transfer");
    expect(
      describeSparkError(
        new Error("amount must be at least 409 sats"),
        "fallback",
        clockMessage
      )
    ).toBe("amount must be at least 409 sats");
  });
});
