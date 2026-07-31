"use client";
import { formatRelativeDate } from "@/app/lib/time";
import { formatBtc, formatFiat, formatSats } from "@/app/lib/format";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
  Link2,
  Zap,
} from "lucide-react";
import { Transaction } from "../../lib/api";
import { TranslateFn, useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";
import { LanguageCode } from "@/app/lib/translations";

const getTransactionProperties = (
  tx: Transaction,
  currency: string,
  balanceVisible: boolean,
  displayUnit: "sats" | "btc" | "fiat",
  t: TranslateFn,
  language: LanguageCode,
  locale: string
) => {
  const isCredit = tx.type.includes("CREDIT") || tx.type.includes("DEPOSIT");
  const isLightning =
    tx.type.includes("LIGHTNING") || tx.type.includes("INVOICE");
  const isOnchain = tx.type.includes("ONCHAIN");
  const sign = isCredit ? "+" : "−";

  const formatAmount = () => {
    if (!balanceVisible) {
      return "•••••••";
    }

    switch (displayUnit) {
      case "sats":
        return `${sign} ${formatSats(tx.amount, locale)} sats`;
      case "btc":
        return `${sign} ${formatBtc(tx.amount)} BTC`;
      case "fiat": {
        const fiatValue = tx.fiat_equivalents?.[currency];
        return fiatValue !== undefined
          ? `${sign} ${formatFiat(fiatValue, currency, locale)}`
          : "N/A";
      }
      default:
        return `${sign} ${formatSats(tx.amount, locale)} sats`;
    }
  };

  const statusText =
    tx.status === "PENDING"
      ? t("Pending...")
      : tx.status === "FAILED"
        ? t("Failed")
        : formatRelativeDate(tx.date, language);

  let textElement: React.ReactNode = formatAmount();
  if (tx.status === "FAILED" && balanceVisible) {
    textElement = <span className="line-through">{formatAmount()}</span>;
  }

  const amountColor =
    tx.status === "COMPLETED"
      ? isCredit
        ? "text-credit"
        : "text-debit"
      : tx.status === "PENDING"
        ? "text-pending"
        : "text-muted";

  const TypeIcon = isLightning ? Zap : isOnchain ? Bitcoin : Link2;
  const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;

  return {
    amountColor,
    text: textElement,
    statusText,
    TypeIcon,
    DirectionIcon,
    isCredit,
    typeLabel: isLightning
      ? t("Lightning")
      : isOnchain
        ? t("Bitcoin")
        : t("Transfer"),
  };
};

export const TransactionsTab = ({
  transactions,
  currency,
  balanceVisible,
  displayUnit,
}: {
  transactions: Transaction[];
  currency: string;
  balanceVisible: boolean;
  displayUnit: "sats" | "btc" | "fiat";
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleTransactions = showAll ? transactions : transactions.slice(0, 5);
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";

  return (
    <section aria-labelledby="transactions-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 id="transactions-heading" className="text-xl sm:text-2xl font-semibold">
          {t("Recent Transactions")}
        </h2>
      </div>
      <ul className="space-y-2" role="list">
        {transactions.length > 0 ? (
          visibleTransactions.map((tx) => {
            const {
              amountColor,
              text,
              statusText,
              TypeIcon,
              DirectionIcon,
              typeLabel,
            } = getTransactionProperties(
              tx,
              currency,
              balanceVisible,
              displayUnit,
              t,
              language,
              locale
            );
            return (
              <li
                key={tx.id}
                className="border border-panel-edge bg-panel-elevated/60 px-3 sm:px-4 py-3 rounded-lg flex justify-between items-center gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg bg-input border border-panel-edge shrink-0"
                    aria-hidden="true"
                  >
                    <TypeIcon className="w-4 h-4 text-accent" />
                    <DirectionIcon className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-muted-strong bg-panel rounded-full" />
                  </span>
                  <div className="min-w-0">
                    <p className={`font-amount font-medium truncate ${amountColor}`}>
                      {text}
                    </p>
                    <p className="text-xs text-muted truncate">{typeLabel}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm text-muted">{statusText}</p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="text-muted text-center py-10 border border-dashed border-panel-edge rounded-lg">
            {t("No transactions found in the last 30 days.")}
          </li>
        )}
      </ul>
      {transactions.length > 5 && !showAll && (
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-accent hover:text-accent-hover min-h-11 inline-flex items-center px-3"
          >
            {t("See more")}
          </button>
        </div>
      )}
    </section>
  );
};
