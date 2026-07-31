import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBtcPrice } from "@/app/hooks/useBtcPrice";

const apiCall = vi.fn();

vi.mock("@/app/lib/api", () => ({
  apiCall: (...args: unknown[]) => apiCall(...args),
}));

describe("useBtcPrice", () => {
  beforeEach(() => {
    apiCall.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the current price for the selected currency", async () => {
    apiCall.mockResolvedValue({
      currency: "usd",
      price: 65000.5,
      updatedAt: "2026-07-29T12:00:00Z",
    });

    const { result } = renderHook(() => useBtcPrice("USD"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiCall).toHaveBeenCalledWith(
      "/general-data/btc-price/current?currency=usd"
    );
    expect(result.current.price).toEqual({
      currency: "usd",
      price: 65000.5,
      updatedAt: "2026-07-29T12:00:00Z",
    });
    expect(result.current.error).toBe(false);
  });

  it("refetches when currency changes", async () => {
    apiCall
      .mockResolvedValueOnce({
        currency: "usd",
        price: 1,
        updatedAt: "2026-07-29T12:00:00Z",
      })
      .mockResolvedValueOnce({
        currency: "eur",
        price: 2,
        updatedAt: "2026-07-29T12:01:00Z",
      });

    const { result, rerender } = renderHook(
      ({ currency }) => useBtcPrice(currency),
      { initialProps: { currency: "usd" } }
    );

    await waitFor(() => expect(result.current.price?.currency).toBe("usd"));

    rerender({ currency: "EUR" });

    await waitFor(() => expect(result.current.price?.currency).toBe("eur"));
    expect(apiCall).toHaveBeenCalledWith(
      "/general-data/btc-price/current?currency=eur"
    );
    expect(result.current.price?.price).toBe(2);
  });

  it("hides price state on error without throwing", async () => {
    apiCall.mockRejectedValue(new Error("Service Unavailable"));

    const { result } = renderHook(() => useBtcPrice("usd"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(true);
    expect(result.current.price).toBeNull();
  });

  it("exposes refresh for Zap-driven parallel refresh", async () => {
    apiCall
      .mockResolvedValueOnce({
        currency: "usd",
        price: 10,
        updatedAt: "2026-07-29T12:00:00Z",
      })
      .mockResolvedValueOnce({
        currency: "usd",
        price: 11,
        updatedAt: "2026-07-29T12:02:00Z",
      });

    const { result } = renderHook(() => useBtcPrice("usd"));
    await waitFor(() => expect(result.current.price?.price).toBe(10));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.price?.price).toBe(11));
    expect(apiCall).toHaveBeenCalledTimes(2);
  });
});
