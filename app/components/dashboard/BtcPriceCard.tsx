"use client";

import { useId, useState } from "react";
import {
  BtcPricePoint,
  BtcPriceRange,
  useBtcPriceFeed,
} from "@/app/hooks/useBtcPriceFeed";
import { useTranslation } from "@/app/hooks/useTranslation";

const AVAILABLE_RANGES: BtcPriceRange[] = ["1h", "24h", "7d"];

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 240;
const CHART_TOP = 18;
const CHART_BOTTOM = 16;
const CHART_LEFT = 8;
const CHART_RIGHT = 8;

const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(price);
};

const formatAxisValue = (price: number) => {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(price);
};

const formatTime = (timestamp: string | null) => {
  if (!timestamp) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const smoothing = 0.16;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;

    const controlPointOneX =
      current.x + (next.x - previous.x) * smoothing;
    const controlPointOneY =
      current.y + (next.y - previous.y) * smoothing;
    const controlPointTwoX =
      next.x - (following.x - current.x) * smoothing;
    const controlPointTwoY =
      next.y - (following.y - current.y) * smoothing;

    path += ` C ${controlPointOneX} ${controlPointOneY}, ${controlPointTwoX} ${controlPointTwoY}, ${next.x} ${next.y}`;
  }

  return path;
};

const buildChartGeometry = (points: BtcPricePoint[]) => {
  if (points.length === 0) {
    return {
      areaPath: "",
      chartPoints: [] as Array<{ x: number; y: number }>,
      horizontalRows: [] as Array<{ value: number; y: number }>,
      linePath: "",
      verticalColumns: [] as number[],
    };
  }

  const drawableWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const drawableHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

  const prices = points.map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const safeRange = maxPrice - minPrice || 1;

  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? CHART_LEFT + drawableWidth / 2
        : CHART_LEFT + (index / (points.length - 1)) * drawableWidth;
    const y =
      CHART_TOP + ((maxPrice - point.price) / safeRange) * drawableHeight;

    return { x, y };
  });

  const linePath = buildSmoothPath(chartPoints);
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];
  const areaPath = linePath
    ? `${linePath} L ${lastPoint.x} ${CHART_HEIGHT - CHART_BOTTOM} L ${
        firstPoint.x
      } ${CHART_HEIGHT - CHART_BOTTOM} Z`
    : "";

  const horizontalRows = Array.from({ length: 4 }, (_, index) => {
    const y = CHART_TOP + (drawableHeight / 3) * index;

    return {
      value: maxPrice - (safeRange / 3) * index,
      y,
    };
  });

  const verticalColumns = [0.18, 0.35, 0.52, 0.69, 0.86].map(
    (ratio) => CHART_LEFT + drawableWidth * ratio
  );

  return {
    areaPath,
    chartPoints,
    horizontalRows,
    linePath,
    verticalColumns,
  };
};

const PriceChart = ({
  currency,
  points,
  positive,
}: {
  currency: string;
  points: BtcPricePoint[];
  positive: boolean;
}) => {
  const { areaPath, chartPoints, horizontalRows, linePath, verticalColumns } =
    buildChartGeometry(points);
  const chartId = useId().replace(/:/g, "");
  const areaGradientId = `${chartId}-area-gradient`;
  const glowFilterId = `${chartId}-glow-filter`;
  const lineColor = positive ? "#24f45c" : "#ff6b7c";
  const shadowColor = positive
    ? "rgba(36, 244, 92, 0.18)"
    : "rgba(255, 107, 124, 0.16)";
  const areaColor = positive
    ? "rgba(36, 244, 92, 0.12)"
    : "rgba(255, 107, 124, 0.1)";
  const lastPoint = chartPoints[chartPoints.length - 1] ?? null;

  return (
    <div className="rounded-[22px] border border-white/[0.04] bg-[#101827] px-3 py-3 sm:px-4 sm:py-4">
      <div className="relative h-[170px] w-full sm:h-[205px] lg:h-[225px]">
        <div className="absolute inset-y-0 right-0 w-10 text-[11px] text-slate-500/80">
          {horizontalRows.map((row, index) => (
            <div
              key={`${currency}-${index}`}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(row.y / CHART_HEIGHT) * 100}%` }}
            >
              {formatAxisValue(row.value)}
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-0 right-10">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            shapeRendering="geometricPrecision"
          >
            <defs>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={areaColor} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </linearGradient>
              <filter
                id={glowFilterId}
                x="-8%"
                y="-16%"
                width="116%"
                height="132%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="5"
                  floodColor={lineColor}
                  floodOpacity="0.22"
                />
              </filter>
            </defs>

            {horizontalRows.map((row, index) => (
              <line
                key={`horizontal-${index}`}
                x1="0"
                x2={CHART_WIDTH}
                y1={row.y}
                y2={row.y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeWidth="1"
              />
            ))}

            {verticalColumns.map((column, index) => (
              <line
                key={`vertical-${index}`}
                x1={column}
                x2={column}
                y1={CHART_TOP - 3}
                y2={CHART_HEIGHT - CHART_BOTTOM + 3}
                stroke="rgba(148, 163, 184, 0.055)"
                strokeWidth="1"
              />
            ))}

            {areaPath && <path d={areaPath} fill={`url(#${areaGradientId})`} />}

            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={lineColor}
                strokeWidth="4.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowFilterId})`}
                opacity="0.88"
              />
            )}

            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={lineColor}
                strokeWidth="2.15"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {lastPoint && (
              <>
                <circle cx={lastPoint.x} cy={lastPoint.y} r="8" fill={shadowColor} />
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="3.6"
                  fill="#101827"
                  stroke={lineColor}
                  strokeWidth="1.9"
                />
                <circle cx={lastPoint.x} cy={lastPoint.y} r="1.8" fill={lineColor} />
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

export const BtcPriceCard = ({ currency }: { currency: string }) => {
  const [range, setRange] = useState<BtcPriceRange>("24h");
  const { currentPrice, error, lastUpdatedAt, loading, points, stale } =
    useBtcPriceFeed({ currency, range });
  const t = useTranslation();

  const latestPrice = currentPrice ?? points[points.length - 1]?.price ?? null;
  const openingPrice = points[0]?.price ?? latestPrice;
  const priceChangePercent =
    latestPrice !== null && openingPrice
      ? ((latestPrice - openingPrice) / openingPrice) * 100
      : null;
  const positiveChange =
    priceChangePercent === null ? true : priceChangePercent >= 0;

  return (
    <section className="mb-8 overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#171f2d] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.26)] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-slate-500">
            {t("BTC Price")}
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            <h2 className="text-[40px] font-semibold tracking-tight text-slate-50 sm:text-[48px] lg:text-[52px]">
              {latestPrice !== null ? formatPrice(latestPrice, currency) : "--"}
            </h2>

            {priceChangePercent !== null && (
              <span
                className={`pb-1 text-lg font-semibold sm:text-[26px] ${
                  positiveChange ? "text-[#24f45c]" : "text-[#ff6b7c]"
                }`}
              >
                {`${positiveChange ? "+" : ""}${priceChangePercent.toFixed(2)}%`}
              </span>
            )}
          </div>

          <p
            className={`mt-2 text-xs uppercase tracking-[0.28em] sm:text-[13px] ${
              stale ? "text-amber-300/80" : "text-slate-500"
            }`}
          >
            {currency.toUpperCase()} · {t("Updated {time}", { time: formatTime(lastUpdatedAt) })}
          </p>
        </div>

        <div className="inline-flex w-full rounded-[18px] border border-white/[0.04] bg-[#222c3d] p-1 sm:w-auto">
          {AVAILABLE_RANGES.map((availableRange) => {
            const isActive = availableRange === range;

            return (
              <button
                key={availableRange}
                type="button"
                onClick={() => setRange(availableRange)}
                className={`flex-1 rounded-[14px] px-4 py-2.5 text-sm font-semibold tracking-[0.14em] transition-colors sm:min-w-[74px] ${
                  isActive
                    ? "bg-[#313d51] text-[#24f45c]"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {availableRange.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-14 w-72 max-w-full rounded-2xl bg-white/5" />
          <div className="h-[210px] rounded-[22px] bg-[#101827]" />
        </div>
      ) : error && points.length === 0 ? (
        <div className="rounded-[22px] border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-200">
          {error || t("Unable to load BTC price.")}
        </div>
      ) : (
        <PriceChart
          currency={currency}
          points={points}
          positive={positiveChange}
        />
      )}
    </section>
  );
};
