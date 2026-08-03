"use client";

import { Check, ClipboardCopy, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { IconButton } from "../ui/IconButton";
import { useSpark } from "./SparkProvider";

export const SparkDeposit = () => {
  const t = useTranslation();
  const { wallet } = useSpark();
  const [singleUse, setSingleUse] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

  const loadAddress = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const addr = singleUse
        ? await wallet.getSingleUseDepositAddress()
        : await wallet.getStaticDepositAddress();
      setAddress(addr);
    } catch (err: any) {
      setError(err?.message ?? t("Could not generate a deposit address."));
    } finally {
      setLoading(false);
    }
  }, [wallet, singleUse, t]);

  useEffect(() => {
    void loadAddress();
  }, [loadAddress]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (text: string) => {
    try {
      await navigator.share({
        title: t("My Spark deposit address"),
        text,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  if (!wallet) {
    return (
      <Alert variant="warning">
        {t("Unlock your wallet to generate a deposit address.")}
      </Alert>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div>
        <p className="text-sm font-semibold mb-2">
          {t("Deposit address")}
          <span className="ml-2 text-xs font-normal text-muted">
            {t("Taproot")}
          </span>
        </p>
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg inline-block">
            {loading || !address ? (
              <div
                role="status"
                className="w-48 h-48 bg-panel-elevated animate-pulse rounded"
                aria-label={t("Generating address...")}
              />
            ) : (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${address}`}
                alt={t("Deposit address")}
                className="w-48 h-48"
              />
            )}
          </div>
        </div>
      </div>

      {address && (
        <div className="bg-input border border-panel-edge rounded-lg px-4 py-2 flex items-center justify-between gap-2">
          <span className="font-address text-sm break-all text-left">
            {address}
          </span>
          <IconButton
            label={t("Copy address")}
            onClick={() => copyToClipboard(address)}
          >
            {copied ? (
              <Check size={18} className="text-success" aria-hidden="true" />
            ) : (
              <ClipboardCopy size={18} aria-hidden="true" />
            )}
          </IconButton>
        </div>
      )}

      <p className="text-xs text-muted">
        {t("You pay the network fee on the sending side.")}
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setSingleUse(true)}
          aria-pressed={singleUse}
          className="min-h-11 px-4 text-sm font-semibold rounded-lg border border-panel-edge bg-panel-elevated touch-manipulation"
        >
          {t("Single-use")}
        </button>
        <button
          type="button"
          onClick={() => setSingleUse(false)}
          aria-pressed={!singleUse}
          className="min-h-11 px-4 text-sm font-semibold rounded-lg border border-panel-edge bg-panel-elevated touch-manipulation"
        >
          {t("Reusable")}
        </button>
      </div>
      <p className="text-xs text-muted">
        {singleUse
          ? t(
              "A fresh address for each deposit — best for privacy. Use the same address only once."
            )
          : t(
              "One permanent address. Its key is shared with the payment operator, so single-use addresses are more private."
            )}
      </p>

      {showShareButton && address && (
        <button
          type="button"
          onClick={() => handleShare(address)}
          className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition flex items-center justify-center touch-manipulation"
        >
          <Share2 size={18} className="mr-2" aria-hidden="true" />
          {t("Share")}
        </button>
      )}
    </div>
  );
};
