"use client";

import { Bitcoin, Check, ClipboardCopy, Edit, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { IconButton } from "../ui/IconButton";
import { useSpark } from "./SparkProvider";

const fieldClass =
  "w-full pl-10 pr-4 py-3 bg-input border border-panel-edge rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-foreground";

export const SparkLightningReceive = ({
  requireAmount,
}: {
  requireAmount: boolean;
}) => {
  const t = useTranslation();
  const { wallet } = useSpark();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

  const handleGenerate = async () => {
    if (!wallet) return;
    setLoading(true);
    setError("");
    setInvoice(null);
    try {
      const request = await wallet.createLightningInvoice({
        amountSats: requireAmount ? Number(amount) : 0,
        memo: memo || undefined,
        expirySeconds: 86400,
      });
      setInvoice(request.invoice.encodedInvoice);
    } catch (err: any) {
      setError(err?.message ?? t("Could not generate an invoice."));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (text: string) => {
    try {
      await navigator.share({ title: t("Lightning invoice"), text });
    } catch {
      // User cancelled share sheet
    }
  };

  if (!wallet) {
    return (
      <Alert variant="warning">
        {t("Unlock your wallet to generate an invoice.")}
      </Alert>
    );
  }

  if (invoice) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-white p-4 rounded-lg inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice}`}
            alt={t("Invoice QR Code")}
            className="w-48 h-48"
          />
        </div>
        <div className="bg-input border border-panel-edge rounded-lg px-4 py-2 flex items-center justify-between gap-2">
          <span className="font-address text-xs break-all text-left">
            {invoice}
          </span>
          <IconButton
            label={t("Copy invoice")}
            onClick={() => copyToClipboard(invoice)}
          >
            {copied ? (
              <Check size={18} className="text-success" aria-hidden="true" />
            ) : (
              <ClipboardCopy size={18} aria-hidden="true" />
            )}
          </IconButton>
        </div>
        {showShareButton && (
          <button
            type="button"
            onClick={() => handleShare(invoice)}
            className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition flex items-center justify-center touch-manipulation"
          >
            <Share2 size={18} className="mr-2" aria-hidden="true" />
            {t("Share")}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setInvoice(null);
            setAmount("");
            setMemo("");
          }}
          className="w-full min-h-11 text-sm font-semibold text-muted hover:text-foreground transition touch-manipulation"
        >
          {t("Generate another")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="spark-receive-amount" className="sr-only">
          {t("Amount (sats)")}
        </label>
        <Bitcoin
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          size={20}
          aria-hidden="true"
        />
        <input
          id="spark-receive-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={
            requireAmount
              ? t("Amount (sats)")
              : t("Amount (sats) — optional, any amount")
          }
          className={fieldClass}
        />
      </div>
      <div className="relative">
        <label htmlFor="spark-receive-memo" className="sr-only">
          {t("Memo (optional)")}
        </label>
        <Edit
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          size={20}
          aria-hidden="true"
        />
        <input
          id="spark-receive-memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t("Memo (optional)")}
          className={fieldClass}
        />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || (requireAmount && !amount)}
        className="w-full min-h-11 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 disabled:opacity-50 disabled:pointer-events-none transition touch-manipulation"
      >
        {loading ? t("Generating...") : t("Generate Invoice")}
      </button>
    </div>
  );
};
