"use client";
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
  balanceVisible: boolean
) => {
  const isCredit = tx.type.includes("CREDIT") || tx.type.includes("DEPOSIT");
  const fiatValue = tx.fiat_equivalents?.[currency];

  if (!balanceVisible) {
    return {
      color: "text-gray-400",
      text: "•••••••",
      statusText: new Date(tx.date).toLocaleString(),
      fiatText: "",
    };
  }

  switch (tx.status) {
    case "PENDING":
      return {
        color: "text-yellow-400",
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: "Pending...",
        fiatText: fiatValue
          ? `~ ${currencyFormatter(fiatValue, currency)}`
          : "",
      };
    case "FAILED":
      return {
        color: "text-gray-400",
        text: (
          <span className="line-through">
            {isCredit ? "+" : "-"} {tx.amount.toLocaleString()} sats
          </span>
        ),
        statusText: "Failed",
        fiatText: "",
      };
    case "COMPLETED":
    default:
      return {
        color: isCredit ? "text-green-400" : "text-red-400",
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: new Date(tx.date).toLocaleString(),
        fiatText: fiatValue
          ? `~ ${currencyFormatter(fiatValue, currency)}`
          : "",
      };
  }
};

export const TransactionsTab = ({
  transactions,
  currency,
  balanceVisible,
}: {
  transactions: Transaction[];
  currency: string;
  balanceVisible: boolean;
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleTransactions = showAll ? transactions : transactions.slice(0, 5);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length > 0 ? (
          visibleTransactions.map((tx) => {
            const { color, text, statusText, fiatText } =
              getTransactionProperties(tx, currency, balanceVisible);
            return (
              <div
                key={tx.id}
                className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className={`font-bold ${color}`}>{text}</p>
                  {fiatText && (
                    <p className="font-mono text-xs text-gray-500 mt-1">
                      {fiatText}
                    </p>
                  )}
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
            className="text-yellow-400 hover:text-yellow-300"
          >
            See more
          </button>
        </div>
      )}
    </div>
  );
};
