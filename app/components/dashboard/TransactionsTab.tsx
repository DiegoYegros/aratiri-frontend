"use client";
import { formatRelativeDate } from "@/app/lib/time";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Transaction } from "../../lib/api";

const formatFullDate = (date: string): string => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type TypeInfo = {
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  gradient: string;
};

const transactionTypeInfo: Record<Transaction["type"], TypeInfo> = {
  LIGHTNING_CREDIT: {
    label: "Lightning Payment Received",
    description: "Instant payment over the Lightning Network.",
    icon: ArrowDownLeft,
    iconBg: "bg-green-500/15",
    iconColor: "text-green-300",
    gradient: "from-green-500/10 via-transparent to-transparent",
  },
  LIGHTNING_DEBIT: {
    label: "Lightning Payment Sent",
    description: "Outgoing Lightning payment to another wallet.",
    icon: ArrowUpRight,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-300",
    gradient: "from-red-500/10 via-transparent to-transparent",
  },
  ONCHAIN_CREDIT: {
    label: "On-chain Deposit",
    description: "Bitcoin transaction confirmed on-chain.",
    icon: Landmark,
    iconBg: "bg-green-500/15",
    iconColor: "text-green-300",
    gradient: "from-green-500/10 via-transparent to-transparent",
  },
  ONCHAIN_DEBIT: {
    label: "On-chain Withdrawal",
    description: "Funds sent to a Bitcoin address.",
    icon: Landmark,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-300",
    gradient: "from-red-500/10 via-transparent to-transparent",
  },
  INVOICE_CREDIT: {
    label: "Invoice Paid To You",
    description: "A Lightning invoice you issued has been paid.",
    icon: Zap,
    iconBg: "bg-green-500/15",
    iconColor: "text-green-300",
    gradient: "from-green-500/10 via-transparent to-transparent",
  },
  INVOICE_DEBIT: {
    label: "Invoice You Paid",
    description: "You settled a Lightning invoice.",
    icon: Zap,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-300",
    gradient: "from-red-500/10 via-transparent to-transparent",
  },
  INTERNAL_TRANSFER_CREDIT: {
    label: "Internal Transfer Received",
    description: "Transfer from another Aratiri user.",
    icon: ArrowLeftRight,
    iconBg: "bg-green-500/15",
    iconColor: "text-green-300",
    gradient: "from-green-500/10 via-transparent to-transparent",
  },
  INTERNAL_TRANSFER_DEBIT: {
    label: "Internal Transfer Sent",
    description: "You sent funds to another Aratiri account.",
    icon: ArrowLeftRight,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-300",
    gradient: "from-red-500/10 via-transparent to-transparent",
  },
  CREDIT: {
    label: "Account Credit",
    description: "General funds added to your balance.",
    icon: ArrowDownLeft,
    iconBg: "bg-green-500/15",
    iconColor: "text-green-300",
    gradient: "from-green-500/10 via-transparent to-transparent",
  },
  DEBIT: {
    label: "Account Debit",
    description: "General funds deducted from your balance.",
    icon: ArrowUpRight,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-300",
    gradient: "from-red-500/10 via-transparent to-transparent",
  },
};

const defaultTypeInfo: TypeInfo = {
  label: "Transaction",
  description: "Movement of funds on your account.",
  icon: Wallet,
  iconBg: "bg-yellow-500/15",
  iconColor: "text-yellow-300",
  gradient: "from-yellow-500/10 via-transparent to-transparent",
};

const statusBadgeStyles: Record<
  Transaction["status"],
  { label: string; classes: string }
> = {
  COMPLETED: {
    label: "Completed",
    classes: "border-green-500/40 bg-green-500/10 text-green-300",
  },
  PENDING: {
    label: "Pending",
    classes: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  },
  FAILED: {
    label: "Failed",
    classes: "border-red-500/40 bg-red-500/10 text-red-300",
  },
};

const getNetworkLabel = (type: Transaction["type"]): string => {
  if (type.includes("LIGHTNING") || type.includes("INVOICE")) {
    return "Lightning";
  }
  if (type.includes("ONCHAIN")) {
    return "On-chain";
  }
  if (type.includes("INTERNAL")) {
    return "Internal";
  }
  return "General";
};

const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <div className="mt-1 text-sm text-gray-200">{value}</div>
  </div>
);

const currencyFormatter = (amount: number, currency: string): string => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getTransactionProperties = (
  tx: Transaction,
  currency: string,
  balanceVisible: boolean,
  displayUnit: "sats" | "btc" | "fiat"
) => {
  const isCredit = tx.type.includes("CREDIT") || tx.type.includes("DEPOSIT");
  const sign = isCredit ? "+" : "-";

  const formatAmount = () => {
    if (!balanceVisible) {
      return "•••••••";
    }

    switch (displayUnit) {
      case "sats":
        return `${sign} ${tx.amount.toLocaleString()} sats`;
      case "btc":
        const btcAmount = (tx.amount / 100_000_000).toFixed(8);
        return `${sign} ${btcAmount} BTC`;
      case "fiat":
        const fiatValue = tx.fiat_equivalents?.[currency];
        return fiatValue !== undefined
          ? `${sign} ${currencyFormatter(fiatValue, currency)}`
          : "N/A";
      default:
        return `${sign} ${tx.amount.toLocaleString()} sats`;
    }
  };
  const statusText =
    tx.status === "PENDING"
      ? "Pending..."
      : tx.status === "FAILED"
      ? "Failed"
      : formatRelativeDate(tx.date);

  let textElement: ReactNode = formatAmount();
  if (tx.status === "FAILED" && balanceVisible) {
    textElement = <span className="line-through">{formatAmount()}</span>;
  }

  const breakdown: { label: string; value: string }[] = [];
  if (balanceVisible) {
    breakdown.push({
      label: "SATS",
      value: `${sign} ${tx.amount.toLocaleString()} sats`,
    });

    breakdown.push({
      label: "BTC",
      value: `${sign} ${(tx.amount / 100_000_000).toFixed(8)} BTC`,
    });

    const fiatValue = tx.fiat_equivalents?.[currency];
    if (fiatValue !== undefined) {
      breakdown.push({
        label: currency.toUpperCase(),
        value: `${sign} ${currencyFormatter(Math.abs(fiatValue), currency)}`,
      });
    }
  }

  return {
    color:
      tx.status === "COMPLETED"
        ? isCredit
          ? "text-green-400"
          : "text-red-400"
        : tx.status === "PENDING"
        ? "text-yellow-400"
        : "text-gray-400",
    text: textElement,
    statusText: statusText,
    isCredit,
    breakdown,
  };
};

export const TransactionsTab = ({
  transactions,
  currency,
  balanceVisible,
  displayUnit,
  onUnitToggle,
}: {
  transactions: Transaction[];
  currency: string;
  balanceVisible: boolean;
  displayUnit: "sats" | "btc" | "fiat";
  onUnitToggle: () => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleTransactions = showAll ? transactions : transactions.slice(0, 5);
  const displayUnitLabel =
    displayUnit === "fiat" ? currency.toUpperCase() : displayUnit.toUpperCase();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recent Transactions</h2>
          <p className="text-sm text-gray-400">
            Tap an amount to cycle between sats, BTC and {currency.toUpperCase()}.
          </p>
        </div>
      </div>
      <div className="space-y-5">
        {transactions.length > 0 ? (
          visibleTransactions.map((tx) => {
            const { color, text, statusText, isCredit, breakdown } =
              getTransactionProperties(
                tx,
                currency,
                balanceVisible,
                displayUnit
              );
            const typeInfo = transactionTypeInfo[tx.type] || defaultTypeInfo;
            const statusBadge = statusBadgeStyles[tx.status];
            const networkLabel = getNetworkLabel(tx.type);
            const directionLabel = isCredit ? "Incoming" : "Outgoing";
            return (
              <div
                key={tx.id}
                className="group relative overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-800/60 p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-yellow-500/20"
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${typeInfo.gradient} opacity-60 transition duration-300 group-hover:opacity-80`}
                  aria-hidden="true"
                />
                <div
                  className="relative space-y-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`rounded-xl p-3 ${typeInfo.iconBg}`}>
                        <typeInfo.icon
                          className={`h-6 w-6 ${typeInfo.iconColor}`}
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold">
                            {typeInfo.label}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge.classes}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          {typeInfo.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-left text-sm text-gray-400 sm:text-right">
                      <p>{statusText}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatFullDate(tx.date)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={onUnitToggle}
                        title="Click to change unit"
                        className="w-full rounded-xl border border-transparent bg-gray-900/40 p-4 text-left transition hover:border-yellow-500/30 hover:bg-gray-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/40 sm:w-auto"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Amount ({balanceVisible ? displayUnitLabel : "Hidden"})
                        </p>
                        <p className={`text-2xl font-bold ${color}`}>{text}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Click to cycle through sats, BTC and fiat
                        </p>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        {balanceVisible ? (
                          breakdown.map((item) => (
                            <span
                              key={item.label}
                              className="rounded-full border border-gray-800/60 bg-gray-900/60 px-3 py-1 text-xs text-gray-200"
                            >
                              <span className="mr-1 text-gray-500">
                                {item.label}:
                              </span>
                              {item.value}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-gray-800/60 bg-gray-900/60 px-3 py-1 text-xs text-gray-400">
                            Amounts hidden
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <InfoItem label="Network" value={networkLabel} />
                      <InfoItem
                        label="Direction"
                        value={
                          <span
                            className={`font-medium ${
                              isCredit ? "text-green-300" : "text-red-300"
                            }`}
                          >
                            {directionLabel}
                          </span>
                        }
                      />
                      <InfoItem
                        label="Transaction ID"
                        value={
                          <span className="font-mono text-xs text-gray-300 break-all">
                            {tx.id}
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-400 text-center py-8">
            No transactions found in the last 30 days.
          </p>
        )}
      </div>
      {transactions.length > 5 && !showAll && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(true)}
            className="text-yellow-400 hover:text-yellow-300"
          >
            See more
          </button>
        </div>
      )}
    </div>
  );
};
