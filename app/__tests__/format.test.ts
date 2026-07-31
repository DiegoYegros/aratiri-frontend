import { describe, expect, it } from "vitest";
import { formatFiat, formatFiatAmount } from "@/app/lib/format";

describe("formatFiat", () => {
  it("uses currency style instead of decimal+currency misuse", () => {
    const formatted = formatFiat(1234.5, "usd", "en-US");
    expect(formatted).toMatch(/\$/);
    expect(formatted).toContain("1,234.50");
  });

  it("intentionally embeds a locale currency form for spot price and transaction rows", () => {
    const usd = formatFiat(65, "usd", "en-US");
    expect(usd).toMatch(/\$|USD|US\$/);
    expect(usd).not.toBe(formatFiatAmount(65, "en-US"));

    const eur = formatFiat(65, "eur", "es-ES");
    expect(eur).toMatch(/€|EUR/);
    expect(eur).not.toBe(formatFiatAmount(65, "es-ES"));
  });
});

describe("formatFiatAmount", () => {
  it("formats a plain locale number without currency symbol or ISO code", () => {
    expect(formatFiatAmount(0, "es-ES")).toBe("0,00");
    expect(formatFiatAmount(1234.5, "en-US")).toBe("1,234.50");
    expect(formatFiatAmount(1.23, "es-ES")).not.toMatch(/\$|US\$|USD|EUR/);
  });
});
