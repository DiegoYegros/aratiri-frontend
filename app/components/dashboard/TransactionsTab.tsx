"use client";
import { ArrowLeft, ArrowRight, Loader, ShieldAlert } from "lucide-react";
import { Transaction } from "../../lib/api";

const getTransactionProperties = (tx: Transaction) => {
  const isCredit = tx.type.includes("CREDIT") || tx.type.includes("DEPOSIT");

  switch (tx.status) {
    case "PENDING":
      return {
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
        icon: <Loader className="animate-spin text-yellow-400" size={20} />,
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: "Pending...",
      };
    case "FAILED":
      return {
        color: "text-gray-400",
        bgColor: "bg-gray-500/20",
        icon: <ShieldAlert className="text-gray-400" size={20} />,
        text: (
          <span className="line-through">
            {isCredit ? "+" : "-"} {tx.amount.toLocaleString()} sats
          </span>
        ),
        statusText: "Failed",
      };
    case "COMPLETED":
    default:
      return {
        color: isCredit ? "text-green-400" : "text-red-400",
        bgColor: isCredit ? "bg-green-500/20" : "bg-red-500/20",
        icon: isCredit ? (
          <ArrowLeft className="text-green-400" size={20} />
        ) : (
          <ArrowRight className="text-red-400" size={20} />
        ),
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: new Date(tx.date).toLocaleString(),
      };
  }
};

export const TransactionsTab = ({
  transactions,
}: {
  transactions: Transaction[];
}) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length > 0 ? (
          transactions.map((tx) => {
            const { color, bgColor, icon, text, statusText } =
              getTransactionProperties(tx);
            return (
              <div
                key={tx.id}
                className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className={`font-bold ${color}`}>{text}</p>
                  <p className="text-sm text-gray-400">{statusText}</p>
                </div>
                <div className={`p-2 rounded-full ${bgColor}`}>{icon}</div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-400 text-center py-8">
            No transactions found in the last 30 days.
          </p>
        )}
      </div>
    </div>
  );
};
