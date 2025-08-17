"use client";
import { formatRelativeDate } from "@/app/lib/time";
import { useState } from "react";
import { Transaction } from "../../lib/api";

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

  let textElement: React.ReactNode = formatAmount();
  if (tx.status === "FAILED" && balanceVisible) {
    textElement = <span className="line-through">{formatAmount()}</span>;
  }

  return {
    color:
      tx.status === "COMPLETED"
        ? isCredit
          ? "text-success"
          : "text-destructive"
        : tx.status === "PENDING"
        ? "text-primary"
        : "text-gray-400",
    text: textElement,
    statusText: statusText,
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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length > 0 ? (
          visibleTransactions.map((tx) => {
            const { color, text, statusText } = getTransactionProperties(
              tx,
              currency,
              balanceVisible,
              displayUnit
            );
            return (
              <div
                key={tx.id}
                className="bg-secondary/50 p-4 rounded-lg flex justify-between items-center"
              >
                <div
                  className="cursor-pointer"
                  onClick={onUnitToggle}
                  title="Click to change unit"
                >
                  <p className={`font-bold ${color}`}>{text}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-400">{statusText}</p>
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
            className="text-primary hover:text-accent"
          >
            See more
          </button>
        </div>
      )}
    </div>
  );
};
