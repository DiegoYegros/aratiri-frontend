"use client";
import { ArrowLeft, Bitcoin, Edit, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiCall,
  DecodedInvoice,
  DecodedResponse,
  EstimateFeeResponse,
  LnurlParams,
} from "../../lib/api";
import { QrScanner } from "./QrScanner";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";
import { SparkFeeLine } from "../spark/SparkFeeLine";
import { describeSparkError } from "../../lib/spark/mapping";
import { SparkSpeedChooser, type ExitSpeedValue } from "../spark/SparkSpeedChooser";
import { useSpark } from "../spark/SparkProvider";
import type { WalletKind } from "../spark/WalletSwitcher";

interface SendModalProps {
  onClose: () => void;
  onPaymentSent: () => void;
  walletKind?: WalletKind;
}

const fieldClass =
  "w-full pl-10 pr-4 py-3 bg-input border border-panel-edge rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-foreground";

interface SparkFeeQuoteLike {
  id: string;
  userFeeFast: { originalValue: number };
  userFeeMedium: { originalValue: number };
  userFeeSlow: { originalValue: number };
  l1BroadcastFeeFast: { originalValue: number };
  l1BroadcastFeeMedium: { originalValue: number };
  l1BroadcastFeeSlow: { originalValue: number };
  expiresAt: string;
}

/** Bond reserved by the SSP during a coop-exit withdrawal, returned on settle. */
const WITHDRAW_BOND_SATS = 10_000;

export const SendModal = ({
  onClose,
  onPaymentSent,
  walletKind = "custodial",
}: SendModalProps) => {
  const spark = useSpark();
  const [inputValue, setInputValue] = useState("");
  const [decoded, setDecoded] = useState<DecodedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lnurlAmount, setLnurlAmount] = useState("");
  const [lnurlComment, setLnurlComment] = useState("");
  const [onChainAmount, setOnChainAmount] = useState("");
  const [fee, setFee] = useState<EstimateFeeResponse | null>(null);
  const [showFee, setShowFee] = useState(false);
  const [sparkFeeEstimate, setSparkFeeEstimate] = useState<number | null>(null);
  const [sparkMaxFee, setSparkMaxFee] = useState(0);
  const [sparkQuote, setSparkQuote] = useState<SparkFeeQuoteLike | null>(null);
  const [sparkSpeed, setSparkSpeed] = useState<ExitSpeedValue>("FAST");
  const t = useTranslation();

  const isSpark = walletKind === "spark";
  const sparkWallet = isSpark ? spark.wallet : null;

  const sparkAvailable = spark.balance?.available ?? null;
  const onChainAmt = parseInt(onChainAmount) || 0;
  const sparkQuoteExpired =
    isSpark && !!sparkQuote && Date.parse(sparkQuote.expiresAt) <= Date.now();

  useEffect(() => {
    if (!decoded || !isSpark) return;
    if (decoded.type === "lightning_invoice" && sparkWallet) {
      const invoice = decoded.data as DecodedInvoice;
      const cap = Math.max(5, Math.round(invoice.num_satoshis * 0.0017));
      setSparkMaxFee(cap);
      setSparkFeeEstimate(null);
      setLoading(true);
      void sparkWallet
        .getLightningSendFeeEstimate({
          encodedInvoice: inputValue,
          amountSats: invoice.num_satoshis,
        })
        .then((est) => setSparkFeeEstimate(est))
        .catch(() => setSparkFeeEstimate(null))
        .finally(() => setLoading(false));
    }
  }, [decoded, isSpark, inputValue, sparkWallet]);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!decoded) {
        handleDecode(inputValue);
      } else if (decoded.type === "bitcoin_address" && !showFee) {
        handleEstimateFee();
      } else {
        handlePay();
      }
    }
  };

  const handleDecode = async (valueToDecode: string) => {
    if (!valueToDecode) return;
    setLoading(true);
    setError("");
    setDecoded(null);
    setSuccess("");
    setLnurlAmount("");
    setLnurlComment("");
    setOnChainAmount("");
    setFee(null);
    setShowFee(false);
    setSparkQuote(null);

    try {
      const data: DecodedResponse = await apiCall(
        `/decoder?input=${encodeURIComponent(valueToDecode)}`
      );

      if (data.type === "error") {
        throw new Error(data.error || t("Unsupported or invalid format"));
      }

      setDecoded(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onScanSuccess = (data: string) => {
    setInputValue(data);
    setIsScanning(false);
    handleDecode(data);
  };

  const handleEstimateFee = async () => {
    if (!decoded || decoded.type !== "bitcoin_address" || !onChainAmount)
      return;
    setLoading(true);
    setError("");
    if (sparkWallet) {
      try {
        const quote = await sparkWallet.getWithdrawalFeeQuote({
          amountSats: parseInt(onChainAmount),
          withdrawalAddress: decoded.data as string,
        });
        if (!quote) throw new Error(t("Fee quote unavailable."));
        setSparkQuote(quote as unknown as SparkFeeQuoteLike);
        setShowFee(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const data: EstimateFeeResponse = await apiCall(
        "/payments/onchain/estimate-fee",
        {
          method: "POST",
          body: JSON.stringify({
            address: decoded.data,
            sats_amount: parseInt(onChainAmount),
          }),
        }
      );
      setFee(data);
      setShowFee(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sparkQuoteTotal = (speed: ExitSpeedValue): number => {
    if (!sparkQuote) return 0;
    const fees: Record<ExitSpeedValue, [number, number]> = {
      FAST: [
        sparkQuote.userFeeFast.originalValue,
        sparkQuote.l1BroadcastFeeFast.originalValue,
      ],
      MEDIUM: [
        sparkQuote.userFeeMedium.originalValue,
        sparkQuote.l1BroadcastFeeMedium.originalValue,
      ],
      SLOW: [
        sparkQuote.userFeeSlow.originalValue,
        sparkQuote.l1BroadcastFeeSlow.originalValue,
      ],
    };
    return fees[speed][0] + fees[speed][1];
  };

  const sparkTotalRequired =
    isSpark && sparkQuote ? onChainAmt + sparkQuoteTotal(sparkSpeed) : 0;
  const sparkBondBlocked =
    isSpark &&
    sparkQuote &&
    sparkAvailable !== null &&
    sparkTotalRequired + WITHDRAW_BOND_SATS > sparkAvailable;

  const handlePay = async () => {
    if (!decoded || !decoded.data) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let data;
      if (isSpark && sparkWallet) {
        if (decoded.type === "lightning_invoice") {
          data = await sparkWallet.payLightningInvoice({
            invoice: inputValue,
            maxFeeSats: sparkMaxFee,
            preferSpark: true,
          });
        } else if (decoded.type === "bitcoin_address" && sparkQuote) {
          if (sparkQuoteExpired) {
            throw new Error(
              t("This fee quote has expired. Go back and re-estimate the fee.")
            );
          }
          const feeAmountSats = sparkQuoteTotal(sparkSpeed);
          data = await sparkWallet.withdraw({
            onchainAddress: decoded.data as string,
            exitSpeed: sparkSpeed as never,
            amountSats: onChainAmt,
            feeAmountSats,
            feeQuoteId: sparkQuote.id,
            deductFeeFromWithdrawalAmount: false,
          });
        } else {
          throw new Error(t("Payment type not supported yet."));
        }
      } else if (decoded.type === "lightning_invoice") {
        data = await apiCall("/payments/invoice", {
          method: "POST",
          body: JSON.stringify({ invoice: inputValue }),
        });
      } else if (decoded.type === "lnurl_params" || decoded.type === "alias") {
        const params = decoded.data as LnurlParams;
        const amountMsat = parseInt(lnurlAmount) * 1000;
        if (
          amountMsat < params.minSendable ||
          amountMsat > params.maxSendable
        ) {
          throw new Error(
            t("Amount must be between {min} and {max} sats.", {
              min: (params.minSendable / 1000).toLocaleString(),
              max: (params.maxSendable / 1000).toLocaleString(),
            })
          );
        }

        data = await apiCall("/lnurl/pay", {
          method: "POST",
          body: JSON.stringify({
            callback: params.callback,
            amount_msat: amountMsat,
            comment: lnurlComment,
          }),
        });
      } else if (decoded.type === "bitcoin_address") {
        data = await apiCall("/payments/onchain", {
          method: "POST",
          body: JSON.stringify({
            address: decoded.data,
            sats_amount: parseInt(onChainAmount),
          }),
        });
      } else {
        throw new Error(t("Payment type not supported yet."));
      }

      setSuccess(
        t("Payment initiated! Status: {status}.", {
          status: (data as { status?: string })?.status ?? t("Completed"),
        })
      );

      // Outgoing ops have no push events: poll until the request settles.
      const typename = (data as { typename?: string } | null)?.typename;
      const reqId = (data as { id?: string } | null)?.id;
      if (typename === "LightningSendRequest" && reqId) {
        spark.trackOutgoing("lightning", reqId);
      } else if (typename === "CoopExitRequest" && reqId) {
        spark.trackOutgoing("withdrawal", reqId);
      }

      setInputValue("");
      setDecoded(null);
      setTimeout(() => {
        onPaymentSent();
      }, 2000);
    } catch (err: any) {
      setError(
        describeSparkError(
          err,
          err.message,
          t(
            "Your device clock looks wrong. Check that the time and timezone are correct, then try again."
          )
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setDecoded(null);
    setError("");
    setSuccess("");
  };

  const primaryBtn =
    "w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition";

  const renderDecodedContent = () => {
    if (!decoded || !decoded.data) return null;

    switch (decoded.type) {
      case "lightning_invoice": {
        const invoice = decoded.data as DecodedInvoice;
        return (
          <div className="mt-6 bg-input border border-panel-edge p-4 rounded-lg space-y-3 animate-fade-in">
            <h3 className="font-semibold text-lg">{t("Invoice Details")}</h3>
            <div>
              <span className="font-medium text-muted">{t("Amount:")}</span>{" "}
              <span className="font-amount">
                {invoice.num_satoshis.toLocaleString()} sats
              </span>
            </div>
            <div className="truncate">
              <span className="font-medium text-muted">{t("Description:")}</span>{" "}
              {invoice.description || "N/A"}
            </div>
            {isSpark && sparkWallet && (
              <SparkFeeLine
                estimateSats={sparkFeeEstimate}
                maxFeeSats={sparkMaxFee}
                onMaxFeeChange={setSparkMaxFee}
                busy={loading}
              />
            )}
            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              className={primaryBtn}
            >
              {loading
                ? t("Paying...")
                : t("Pay {amount} sats", {
                    amount: invoice.num_satoshis.toLocaleString(),
                  })}
            </button>
          </div>
        );
      }

      case "alias":
      case "lnurl_params": {
        const params = decoded.data as LnurlParams;
        const metadata = JSON.parse(params.metadata);
        const description =
          metadata.find((m: any) => m[0] === "text/plain")?.[1] ||
          t("LNURL Payment");

        return (
          <div className="mt-6 bg-input border border-panel-edge p-4 rounded-lg space-y-4 animate-fade-in">
            <h3 className="font-semibold text-lg">{description}</h3>
            <div className="relative">
              <label htmlFor="lnurl-amount" className="sr-only">
                {t("Amount (sats)")}
              </label>
              <Bitcoin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={20}
                aria-hidden="true"
              />
              <input
                id="lnurl-amount"
                type="number"
                value={lnurlAmount}
                onChange={(e) => setLnurlAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("Amount ({min} - {max} sats)", {
                  min: (params.minSendable / 1000).toLocaleString(),
                  max: (params.maxSendable / 1000).toLocaleString(),
                })}
                className={fieldClass}
              />
            </div>
            {params.commentAllowed && params.commentAllowed > 0 && (
              <div className="relative">
                <label htmlFor="lnurl-comment" className="sr-only">
                  {t("Comment (optional, max {count} chars)", {
                    count: params.commentAllowed,
                  })}
                </label>
                <Edit
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  id="lnurl-comment"
                  type="text"
                  value={lnurlComment}
                  onChange={(e) => setLnurlComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("Comment (optional, max {count} chars)", {
                    count: params.commentAllowed,
                  })}
                  maxLength={params.commentAllowed}
                  className={fieldClass}
                />
              </div>
            )}
            <button
              type="button"
              onClick={handlePay}
              disabled={loading || !lnurlAmount}
              className={primaryBtn}
            >
              {loading ? t("Processing...") : t("Pay")}
            </button>
          </div>
        );
      }

      case "bitcoin_address":
        return (
          <div className="mt-6 bg-input border border-panel-edge p-4 rounded-lg space-y-4 animate-fade-in">
            <div className="relative">
              <label htmlFor="onchain-amount" className="sr-only">
                {t("Amount (sats)")}
              </label>
              <Bitcoin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={20}
                aria-hidden="true"
              />
              <input
                id="onchain-amount"
                type="number"
                value={onChainAmount}
                onChange={(e) => setOnChainAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("Amount (sats)")}
                className={fieldClass}
                disabled={showFee}
              />
            </div>
            {isSpark && sparkWallet && showFee && sparkQuote ? (
              <div className="text-center space-y-3">
                <SparkSpeedChooser
                  quote={sparkQuote}
                  speed={sparkSpeed}
                  onChange={setSparkSpeed}
                />
                <p className="text-xs text-muted">
                  {t(
                    "A 10,000-sat bond is reserved during the withdrawal and returned when it settles."
                  )}
                </p>
                {sparkQuoteExpired && (
                  <Alert variant="danger">
                    {t(
                      "This fee quote has expired. Re-estimate to get fresh fees."
                    )}
                  </Alert>
                )}
                {sparkBondBlocked && (
                  <Alert variant="danger">
                    {t(
                      "Total (amount + fee + 10,000-sat bond) exceeds your available balance of {available} sats.",
                      { available: sparkAvailable?.toLocaleString() }
                    )}
                  </Alert>
                )}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={
                    loading || sparkQuoteExpired || Boolean(sparkBondBlocked)
                  }
                  className={`${primaryBtn} mt-4`}
                >
                  {loading ? t("Sending...") : t("Confirm and Send")}
                </button>
                {sparkQuoteExpired && (
                  <button
                    type="button"
                    onClick={handleEstimateFee}
                    disabled={loading}
                    className="w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input disabled:opacity-50 transition"
                  >
                    {t("Re-estimate Fee")}
                  </button>
                )}
              </div>
            ) : showFee && fee ? (
              <div className="text-center space-y-1">
                <p className="font-amount">
                  {t("Fee: {fee} sats", {
                    fee: fee.fee_sat.toLocaleString(),
                  })}
                </p>
                <p className="font-amount">
                  {t("Total: {total} sats", {
                    total: (
                      parseInt(onChainAmount) + fee.fee_sat
                    ).toLocaleString(),
                  })}
                </p>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={loading}
                  className={`${primaryBtn} mt-4`}
                >
                  {loading ? t("Sending...") : t("Confirm and Send")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEstimateFee}
                disabled={loading || !onChainAmount}
                className={primaryBtn}
              >
                {loading ? t("Estimating Fee...") : t("Continue")}
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (isScanning) {
    return (
      <QrScanner
        onScanSuccess={onScanSuccess}
        onClose={() => setIsScanning(false)}
      />
    );
  }

  return (
    <Modal
      title={decoded ? t("Details") : t("Send Payment")}
      onClose={onClose}
      labelledBy="send-modal-title"
      leading={
        decoded ? (
          <IconButton label={t("Back")} onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        ) : undefined
      }
    >
      {!decoded && (
        <div className="space-y-4">
          <label htmlFor="send-input" className="sr-only">
            {t("Paste Invoice, LNURL, Address, or Alias")}
          </label>
          <textarea
            id="send-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Paste Invoice, LNURL, Address, or Alias")}
            className="w-full h-32 px-4 py-3 bg-input border border-panel-edge rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent font-mono text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDecode(inputValue)}
              disabled={loading || !inputValue}
              className="flex-grow min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input disabled:opacity-50 transition"
            >
              {loading ? t("Decoding...") : t("Decode")}
            </button>
            <IconButton
              label={t("Scan QR Code")}
              onClick={() => setIsScanning(true)}
              className="border border-panel-edge bg-panel-elevated hover:bg-input"
            >
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mt-4">
          {success}
        </Alert>
      )}

      {renderDecodedContent()}
    </Modal>
  );
};
