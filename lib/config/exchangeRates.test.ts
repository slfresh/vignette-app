import { describe, expect, it } from "vitest";
import { convertCurrencyToEur } from "./exchangeRates";

describe("convertCurrencyToEur", () => {
  it("returns the same value for EUR", () => {
    expect(convertCurrencyToEur(100, "EUR")).toBe(100);
  });

  it("converts CHF to EUR", () => {
    const result = convertCurrencyToEur(100, "CHF");
    // CHF is close to EUR parity, result should be reasonable
    expect(result).toBeGreaterThan(50);
    expect(result).toBeLessThan(200);
  });

  it("converts CZK to EUR (large amount in CZK = smaller in EUR)", () => {
    const result = convertCurrencyToEur(1000, "CZK");
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThan(100);
  });

  it("converts HUF to EUR (large amount in HUF = smaller in EUR)", () => {
    const result = convertCurrencyToEur(10000, "HUF");
    expect(result).toBeGreaterThan(10);
    expect(result).toBeLessThan(100);
  });

  it("returns 0 for 0 amount", () => {
    expect(convertCurrencyToEur(0, "CHF")).toBe(0);
  });
});
