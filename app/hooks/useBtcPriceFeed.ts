"use client";

import { useEffect, useState } from "react";
import { apiCall } from "../lib/api";

export type BtcPriceRange = "1h" | "24h" | "7d";

export interface BtcPricePoint {
  timestamp: string;
  price: number;
}

interface BtcPriceCurrentResponse {
  currency: string;
  price: number;
  updatedAt: string;
}

interface BtcPriceHistoryResponse {
  currency: string;
  range: BtcPriceRange;
  points: BtcPricePoint[];
}

const CURRENT_POLL_INTERVAL_MS = 15000;
const STALE_AFTER_MS = 45000;
const STALE_CHECK_INTERVAL_MS = 5000;

const POINT_LIMITS: Record<BtcPriceRange, number> = {
  "1h": 120,
  "24h": 288,
  "7d": 336,
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load BTC price.";
};

const normalizePoints = (points: BtcPricePoint[]): BtcPricePoint[] => {
  const uniquePoints = new Map<string, BtcPricePoint>();

  points.forEach((point) => {
    if (
      !point ||
      typeof point.timestamp !== "string" ||
      typeof point.price !== "number" ||
      Number.isNaN(point.price)
    ) {
      return;
    }

    uniquePoints.set(point.timestamp, point);
  });

  return Array.from(uniquePoints.values()).sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

const clampPoints = (points: BtcPricePoint[], range: BtcPriceRange) => {
  const pointLimit = POINT_LIMITS[range];

  if (points.length <= pointLimit) {
    return points;
  }

  return points.slice(points.length - pointLimit);
};

const mergePoint = (
  points: BtcPricePoint[],
  point: BtcPricePoint,
  range: BtcPriceRange
) => clampPoints(normalizePoints([...points, point]), range);

export const useBtcPriceFeed = ({
  currency,
  range,
}: {
  currency: string;
  range: BtcPriceRange;
}) => {
  const [points, setPoints] = useState<BtcPricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      setLoading(true);
      setError(null);
      setPoints([]);
      setCurrentPrice(null);
      setLastUpdatedAt(null);

      const [historyResult, currentResult] = await Promise.allSettled([
        apiCall(
          `/general-data/btc-price/history?currency=${encodeURIComponent(
            currency
          )}&range=${encodeURIComponent(range)}`
        ) as Promise<BtcPriceHistoryResponse>,
        apiCall(
          `/general-data/btc-price/current?currency=${encodeURIComponent(
            currency
          )}`
        ) as Promise<BtcPriceCurrentResponse>,
      ]);

      if (cancelled) {
        return;
      }

      const history =
        historyResult.status === "fulfilled" ? historyResult.value : null;
      const current =
        currentResult.status === "fulfilled" ? currentResult.value : null;

      let nextPoints = clampPoints(normalizePoints(history?.points || []), range);

      if (current) {
        nextPoints = mergePoint(
          nextPoints,
          {
            timestamp: current.updatedAt,
            price: current.price,
          },
          range
        );
      }

      const latestPoint = nextPoints[nextPoints.length - 1] || null;

      if (!latestPoint && !current) {
        const failure =
          historyResult.status === "rejected"
            ? historyResult.reason
            : currentResult.status === "rejected"
            ? currentResult.reason
            : null;

        setError(getErrorMessage(failure));
        setLoading(false);
        return;
      }

      setPoints(nextPoints);
      setCurrentPrice(current?.price ?? latestPoint?.price ?? null);
      setLastUpdatedAt(current?.updatedAt ?? latestPoint?.timestamp ?? null);
      setLoading(false);
    };

    loadFeed();

    return () => {
      cancelled = true;
    };
  }, [currency, range]);

  useEffect(() => {
    let cancelled = false;

    const refreshCurrentPrice = async () => {
      try {
        const current = (await apiCall(
          `/general-data/btc-price/current?currency=${encodeURIComponent(
            currency
          )}`
        )) as BtcPriceCurrentResponse;

        if (cancelled) {
          return;
        }

        setPoints((existingPoints) =>
          mergePoint(
            existingPoints,
            {
              timestamp: current.updatedAt,
              price: current.price,
            },
            range
          )
        );
        setCurrentPrice(current.price);
        setLastUpdatedAt(current.updatedAt);
        setError(null);
      } catch {
        if (cancelled) {
          return;
        }
      }
    };

    const intervalId = window.setInterval(
      refreshCurrentPrice,
      CURRENT_POLL_INTERVAL_MS
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currency, range]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, STALE_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const stale = lastUpdatedAt
    ? now - new Date(lastUpdatedAt).getTime() > STALE_AFTER_MS
    : false;

  return {
    currentPrice,
    error,
    lastUpdatedAt,
    loading,
    points,
    stale,
  };
};
