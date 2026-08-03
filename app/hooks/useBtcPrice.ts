"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicApiGet, CurrentBtcPrice } from "../lib/api";

const POLL_MS = 60_000;

export const useBtcPrice = (selectedCurrency: string) => {
  const [price, setPrice] = useState<CurrentBtcPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currency = selectedCurrency.toLowerCase();
    if (!currency) return;

    const id = ++requestId.current;
    setLoading(true);
    setError(false);

    try {
      const data = await publicApiGet<CurrentBtcPrice>(
        `/general-data/btc-price/current?currency=${encodeURIComponent(currency)}`
      );
      if (id !== requestId.current) return;
      setPrice(data);
      setError(false);
    } catch {
      if (id !== requestId.current) return;
      setPrice(null);
      setError(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [selectedCurrency]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { price, loading, error, refresh };
};
